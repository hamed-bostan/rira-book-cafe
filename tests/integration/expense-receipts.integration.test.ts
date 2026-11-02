import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PUT as setReceipt } from "@/app/api/admin/expenses/[id]/receipt/route";
import { POST as voidExpense } from "@/app/api/admin/expenses/[id]/void/route";
import { POST as recordExpense } from "@/app/api/admin/expenses/route";
import { POST as upload } from "@/app/api/images/upload/route";
import { GET as serveUpload } from "@/app/uploads/[...path]/route";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { isReceiptUrl, type Expense } from "@/src/domain/entities/Expense";
import { resolveStoredImageFile } from "@/src/infrastructure/container";
import { prisma } from "@/src/infrastructure/prisma/client";

import { formRequest, getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** The smallest valid PNG: a 1×1 transparent pixel. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const MISSING_ID = "00000000-0000-0000-0000-000000000000";

const electricity = {
  date: cafeDayOf(new Date()),
  supplierId: "",
  accountCode: "6100",
  description: "Electricity",
  amount: "1100000",
  vatAmount: "100000",
  payment: "unpaid",
};

/** A one-page PDF, as a supplier's invoice would arrive. */
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n",
  "latin1",
);

function receiptForm(folder = "receipts", file: Blob = new Blob([PNG], { type: "image/png" })): FormData {
  const form = new FormData();
  form.append("file", file, file.type === "application/pdf" ? "invoice.pdf" : "receipt.png");
  form.append("folder", folder);
  return form;
}

const pdfFile = (bytes: Uint8Array<ArrayBuffer> = new Uint8Array(PDF)): Blob =>
  new Blob([bytes], { type: "application/pdf" });

async function uploaded(folder = "receipts", file?: Blob): Promise<string> {
  const response = await upload(formRequest("/api/images/upload", receiptForm(folder, file)));
  expect(response.status).toBe(201);
  return (await readJson<{ image: { url: string } }>(response)).image.url;
}

async function recorded(body: object = electricity): Promise<Expense> {
  const response = await recordExpense(jsonRequest("POST", "/api/admin/expenses", body));
  expect(response.status).toBe(201);
  return readJson<Expense>(response);
}

const put = (id: string, receiptUrl: unknown): Promise<Response> =>
  setReceipt(jsonRequest("PUT", `/api/admin/expenses/${id}/receipt`, { receiptUrl }), routeParams({ id }));

const servePath = (path: string[]): Promise<Response> =>
  serveUpload(getRequest(`/uploads/${path.join("/")}`), { params: Promise.resolve({ path }) });

const serve = (url: string): Promise<Response> => servePath(url.replace(/^\/uploads\//, "").split("/"));

describe("uploading a receipt", () => {
  it("is for whoever can write to the books", async () => {
    expect((await upload(formRequest("/api/images/upload", receiptForm()))).status).toBe(401);

    signInAs("customer");
    expect((await upload(formRequest("/api/images/upload", receiptForm()))).status).toBe(401);

    signInAs("staff");
    expect((await upload(formRequest("/api/images/upload", receiptForm()))).status).toBe(401);
  });

  it("stores it where the books accept it from", async () => {
    signInAs("admin");
    const url = await uploaded();

    expect(url).toMatch(/^\/uploads\/receipts\/.+\.png$/);
    expect(isReceiptUrl(url)).toBe(true);
  });

  it("takes a supplier's PDF", async () => {
    signInAs("admin");
    const url = await uploaded("receipts", pdfFile());

    expect(url).toMatch(/^\/uploads\/receipts\/.+\.pdf$/);
    expect(isReceiptUrl(url)).toBe(true);
  });

  it("takes a receipt larger than an image may be elsewhere, up to 10 MB", async () => {
    signInAs("admin");
    const big = new Uint8Array(6 * 1024 * 1024);
    big.set(PDF);

    expect(await uploaded("receipts", pdfFile(big))).toMatch(/\.pdf$/);

    const tooBig = new Uint8Array(10 * 1024 * 1024 + 1);
    tooBig.set(PDF);
    expect((await upload(formRequest("/api/images/upload", receiptForm("receipts", pdfFile(tooBig))))).status).toBe(
      400,
    );
  });

  it("keeps PDFs out of the public folders", async () => {
    signInAs("admin");
    const response = await upload(formRequest("/api/images/upload", receiptForm("products", pdfFile())));

    expect(response.status).toBe(400);
  });
});

describe("reading a receipt", () => {
  it("serves it to the books' readers, and tells no cache to keep it", async () => {
    signInAs("admin");
    const response = await serve(await uploaded());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/png");
  });

  it("serves a PDF so the browser's viewer can open it, and still privately", async () => {
    signInAs("admin");
    const url = await uploaded("receipts", pdfFile());
    const response = await serve(url);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="receipt.pdf"');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe("frame-ancestors 'none'");

    signInAs("staff");
    expect((await serve(url)).status).toBe(404);
  });

  it("never serves a PDF from a public folder, even one already on disk", async () => {
    const name = `${crypto.randomUUID()}.pdf`;
    const file = resolveStoredImageFile(`products/${name}`) ?? "";
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, PDF);

    try {
      signInAs("admin");
      expect((await servePath(["products", name])).status).toBe(404);
    } finally {
      await rm(file, { force: true });
    }
  });

  it("answers everyone else as if the file weren't there", async () => {
    signInAs("admin");
    const url = await uploaded();

    signInAs(null);
    expect((await serve(url)).status).toBe(404);

    signInAs("customer");
    expect((await serve(url)).status).toBe(404);

    signInAs("staff");
    expect((await serve(url)).status).toBe(404);
  });

  it("can't be reached by walking out of a public folder", async () => {
    signInAs("admin");
    const name = (await uploaded()).split("/").at(-1) ?? "";

    signInAs(null);
    expect((await servePath(["products", "..", "receipts", name])).status).toBe(404);
    expect((await servePath([`products/../receipts/${name}`])).status).toBe(404);
  });

  it("leaves the public folders public and long-cached", async () => {
    signInAs("admin");
    const url = await uploaded("products");

    signInAs(null);
    const response = await serve(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });
});

describe("recording an expense with a receipt", () => {
  it("keeps the receipt on the expense", async () => {
    signInAs("admin");
    const receiptUrl = await uploaded();

    expect(await recorded({ ...electricity, receiptUrl })).toMatchObject({ receiptUrl });
  });

  it("treats a blank one as none", async () => {
    signInAs("admin");

    expect((await recorded({ ...electricity, receiptUrl: "" })).receiptUrl).toBeUndefined();
  });

  it.each([
    "https://evil.example/receipt.png",
    "javascript:alert(1)",
    "/uploads/products/0f8fad5b-d9cb-469f-a165-70867728950e.png",
  ])("refuses %s with 400 and books nothing", async (receiptUrl) => {
    signInAs("admin");
    const [expenses, entries] = [await prisma.expense.count(), await prisma.journalEntry.count()];
    const response = await recordExpense(jsonRequest("POST", "/api/admin/expenses", { ...electricity, receiptUrl }));

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ receiptUrl: "imageInvalid" });
    expect(await prisma.expense.count()).toBe(expenses);
    expect(await prisma.journalEntry.count()).toBe(entries);
  });
});

describe("changing the receipt on a recorded expense", () => {
  it("attaches, replaces and removes it, logging each change and posting nothing", async () => {
    signInAs("admin");
    const expense = await recorded();
    const entries = await prisma.journalEntry.count();
    const [first, second] = [await uploaded(), await uploaded()];

    const attached = await put(expense.id, first);
    expect(attached.status).toBe(200);
    expect(await readJson<Expense>(attached)).toMatchObject({ receiptUrl: first });

    expect(await readJson<Expense>(await put(expense.id, second))).toMatchObject({ receiptUrl: second });

    const removed = await readJson<Expense>(await put(expense.id, ""));
    expect(removed.receiptUrl).toBeUndefined();

    const log = await prisma.activityEntry.findMany({
      where: { entityId: expense.id, action: "expense.receiptChanged" },
      orderBy: { createdAt: "asc" },
    });
    expect(log.map((entry) => entry.changes)).toEqual([
      [{ field: "receiptUrl", before: null, after: first }],
      [{ field: "receiptUrl", before: first, after: second }],
      [{ field: "receiptUrl", before: second, after: null }],
    ]);
    expect(await prisma.journalEntry.count()).toBe(entries);
  });

  it("requires writing to the books", async () => {
    signInAs("admin");
    const expense = await recorded();
    const url = await uploaded();

    signInAs("staff");
    expect((await put(expense.id, url)).status).toBe(401);
  });

  it("refuses a URL it didn't store with 400", async () => {
    signInAs("admin");
    const expense = await recorded();
    const response = await put(expense.id, "https://evil.example/receipt.png");

    expect(response.status).toBe(400);
    expect((await readError(response)).fieldErrors).toMatchObject({ receiptUrl: "imageInvalid" });
  });

  it("answers 404 for an unknown expense", async () => {
    signInAs("admin");

    expect((await put(MISSING_ID, await uploaded())).status).toBe(404);
  });

  it("leaves a void expense as it was", async () => {
    signInAs("admin");
    const expense = await recorded();
    const voided = await voidExpense(
      jsonRequest("POST", `/api/admin/expenses/${expense.id}/void`, { reason: "Entered twice" }),
      routeParams({ id: expense.id }),
    );
    expect(voided.status).toBe(200);

    expect((await put(expense.id, await uploaded())).status).toBe(409);
  });
});

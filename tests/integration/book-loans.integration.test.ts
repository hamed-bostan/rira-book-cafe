import { describe, expect, it } from "vitest";

import { PATCH as changeLoan } from "@/app/api/admin/book-loans/[id]/route";
import { GET as listBooks } from "@/app/api/admin/book-loans/books/route";
import { GET as listLoans, POST as lend } from "@/app/api/admin/book-loans/route";
import { GET as listHolds, POST as addHold } from "@/app/api/admin/book-waitlist/route";
import { DELETE as deleteProduct, PUT as updateProduct } from "@/app/api/products/[id]/route";
import type { BookLoan } from "@/src/domain/entities/BookLoan";
import type { BookWaitlistEntry } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import type { Page } from "@/src/domain/entities/Pagination";
import type { LendableBook } from "@/src/domain/repositories/IBookLoanRepository";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readError, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

/** One copy on the lending shelf (no count set). */
const BLIND_OWL = "seed-book-blind-owl";
const dueOn = shiftCafeDay(cafeDayOf(new Date()), 14);

function lendTo(productId: string, name: string, phone: string): Promise<Response> {
  return lend(
    jsonRequest("POST", "/api/admin/book-loans", {
      productId,
      borrowerName: name,
      borrowerPhone: phone,
      dueOn,
      note: "",
    }),
  );
}

function setStatus(id: string, status: "returned" | "lost"): Promise<Response> {
  return changeLoan(jsonRequest("PATCH", `/api/admin/book-loans/${id}`, { status }), routeParams({ id }));
}

async function book(productId: string): Promise<LendableBook | undefined> {
  return (await readJson<LendableBook[]>(await listBooks())).find((candidate) => candidate.id === productId);
}

describe("the loan book", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = Date.parse("2026-01-01T08:00:00Z");

  /** `count` closed loans, the n-th lent n days after `start` — later ones newer. */
  async function closedLoans(status: "returned" | "lost", count: number, name: string): Promise<void> {
    await prisma.bookLoan.createMany({
      data: Array.from({ length: count }, (_, n) => ({
        productId: BLIND_OWL,
        bookTitle: "The Blind Owl",
        borrowerName: `${name} ${n + 1}`,
        borrowerPhone: `0912${String(n).padStart(7, "0")}`,
        lentAt: new Date(start + n * DAY),
        dueAt: new Date(start + (n + 14) * DAY),
        status,
        returnedAt: status === "returned" ? new Date(start + (n + 7) * DAY) : null,
        lentById: "s1",
        lentByName: "Ali",
      })),
    });
  }

  async function page(query: string): Promise<Page<BookLoan>> {
    const response = await listLoans(getRequest(`/api/admin/book-loans?${query}`));
    expect(response.status).toBe(200);
    return readJson<Page<BookLoan>>(response);
  }

  it("filters each tab on the server and pages it past what one read used to hold", async () => {
    signInAs("admin");
    await closedLoans("returned", 230, "Returned");
    await closedLoans("lost", 3, "Lost");
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 2 } });
    await lendTo(BLIND_OWL, "Niloofar", "09121110005");
    await lendTo(BLIND_OWL, "Parisa", "09121110007");

    const returned = await page("view=returned&pageSize=100&page=3");
    expect(returned).toMatchObject({ total: 230, page: 3, pageSize: 100 });
    expect(returned.items).toHaveLength(30);
    expect(returned.items.every((loan) => loan.status === "returned")).toBe(true);
    // Latest back first: the last page ends with the first one returned.
    expect(returned.items.at(-1)?.borrowerName).toBe("Returned 1");

    const lost = await page("view=lost");
    expect(lost).toMatchObject({ total: 3, page: 1, pageSize: 25 });
    expect(lost.items.map((loan) => loan.borrowerName)).toEqual(["Lost 3", "Lost 2", "Lost 1"]);

    // All: what's still out leads, then the rest newest first, across the page break.
    const first = await page("view=all&pageSize=10");
    expect(first.total).toBe(235);
    expect(first.items.slice(0, 2).map((loan) => loan.status)).toEqual(["out", "out"]);
    expect(first.items.slice(2).every((loan) => loan.status !== "out")).toBe(true);
    const last = await page("view=all&pageSize=10&page=24");
    expect(last.items).toHaveLength(5);
    expect(last.items.at(-1)?.borrowerName).toBe("Returned 1");

    // A search narrows the tab it's in, and its total.
    expect(await page("view=all&q=lost")).toMatchObject({ total: 3 });
    expect(await page("view=returned&q=lost")).toMatchObject({ total: 0, items: [] });
  });

  it("knows which copy of a book is due back first", async () => {
    signInAs("admin");
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 2 } });
    const later = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    const sooner = await readJson<BookLoan>(
      await lend(
        jsonRequest("POST", "/api/admin/book-loans", {
          productId: BLIND_OWL,
          borrowerName: "Parisa",
          borrowerPhone: "09121110007",
          dueOn: shiftCafeDay(cafeDayOf(new Date()), 7),
          note: "",
        }),
      ),
    );

    expect(await book(BLIND_OWL)).toMatchObject({
      onLoan: 2,
      nextDue: { reference: sooner.reference, dueAt: sooner.dueAt },
    });
    expect(later.dueAt > sooner.dueAt).toBe(true);
    expect((await book("seed-book-savushun"))?.nextDue).toBeUndefined();
  });
});

describe("a book with loans or holds", () => {
  /** The Blind Owl's edit form as the dashboard sends it, with `copies` to lend. */
  async function bookForm(copies: string): Promise<Record<string, unknown>> {
    const row = await prisma.product.findUniqueOrThrow({ where: { id: BLIND_OWL } });
    return {
      kind: "book",
      name: row.name,
      categoryId: row.categoryId,
      price: String(row.price),
      originalPrice: "",
      costPrice: "",
      imageUrl: row.imageUrl,
      stockQuantity: String(row.stockQuantity),
      madeToOrder: false,
      isFeatured: row.isFeatured,
      isPublished: row.isPublished,
      badge: "",
      unit: "",
      description: "",
      nutrition: "",
      origin: "",
      dietary: [],
      taxExempt: row.taxExempt,
      bookAuthor: row.bookAuthor ?? "Sadegh Hedayat",
      bookIsbn: "",
      bookAvailability: "both",
      bookCopies: copies,
      faName: "",
      faUnit: "",
      faDescription: "",
      faNutrition: "",
      faOrigin: "",
    };
  }

  function remove(): Promise<Response> {
    return deleteProduct(jsonRequest("DELETE", `/api/products/${BLIND_OWL}`), routeParams({ id: BLIND_OWL }));
  }

  it("can't be deleted while a copy is out, or while a guest is in line", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    const out = await remove();
    expect(out.status).toBe(409);
    expect((await readError(out)).code).toBe("BOOK_IN_USE");

    await addHold(
      jsonRequest("POST", "/api/admin/book-waitlist", {
        productId: BLIND_OWL,
        guestName: "Sara",
        guestPhone: "09351112233",
      }),
    );
    await setStatus(loan.id, "returned");
    // Back on the shelf, but held for Sara.
    const held = await remove();
    expect(held.status).toBe(409);
    expect((await readError(held)).code).toBe("BOOK_IN_USE");
    expect(await prisma.product.count({ where: { id: BLIND_OWL } })).toBe(1);
  });

  it("is deleted once its loans are closed and its line is empty", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await setStatus(loan.id, "returned");
    expect((await remove()).status).toBe(204);
  });

  it("keeps its copies to lend at least the copies out", async () => {
    signInAs("admin");
    await prisma.product.update({ where: { id: BLIND_OWL }, data: { bookCopies: 2 } });
    await lendTo(BLIND_OWL, "Niloofar", "09121110005");
    await lendTo(BLIND_OWL, "Parisa", "09121110007");

    const save = async (copies: string): Promise<Response> =>
      updateProduct(
        jsonRequest("PUT", `/api/products/${BLIND_OWL}`, await bookForm(copies)),
        routeParams({ id: BLIND_OWL }),
      );
    const below = await save("1");
    expect(below.status).toBe(409);
    expect((await readError(below)).code).toBe("COPIES_BELOW_ON_LOAN");
    expect((await save("3")).status).toBe(200);
    expect(await book(BLIND_OWL)).toMatchObject({ copies: 3, onLoan: 2 });
  });
});

describe("a lost copy", () => {
  it("comes off the shelf, so the book can't be lent until it turns up", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    expect((await setStatus(loan.id, "lost")).status).toBe(200);

    expect(await book(BLIND_OWL)).toMatchObject({ copies: 0, onLoan: 0 });
    const refused = await lendTo(BLIND_OWL, "Sara", "09351112233");
    expect(refused.status).toBe(409);
    expect((await readError(refused)).code).toBe("ALL_COPIES_OUT");

    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { action: "bookLoan.lost", entityId: loan.id },
    });
    expect(entry.changes).toEqual([
      { field: "status", before: "out", after: "lost" },
      { field: "bookCopies", before: "1", after: "0" },
    ]);
  });

  it("goes back on the shelf when it turns up, and the next guest in line is told", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await setStatus(loan.id, "lost");
    const waiting = await addHold(
      jsonRequest("POST", "/api/admin/book-waitlist", {
        productId: BLIND_OWL,
        guestName: "Sara",
        guestPhone: "09351112233",
      }),
    );
    expect(waiting.status).toBe(201);

    expect((await setStatus(loan.id, "returned")).status).toBe(200);
    expect(await book(BLIND_OWL)).toMatchObject({ copies: 1, onLoan: 0 });
    const line = await readJson<BookWaitlistEntry[]>(await listHolds(getRequest("/api/admin/book-waitlist")));
    expect(line.filter((entry) => entry.productId === BLIND_OWL).map((entry) => entry.status)).toEqual(["notified"]);

    const entry = await prisma.activityEntry.findFirstOrThrow({
      where: { action: "bookLoan.returned", entityId: loan.id },
    });
    expect(entry.changes).toEqual([
      { field: "status", before: "lost", after: "returned" },
      { field: "bookCopies", before: "0", after: "1" },
    ]);
  });

  it("leaves the copies alone when a book simply comes back", async () => {
    signInAs("admin");
    const loan = await readJson<BookLoan>(await lendTo(BLIND_OWL, "Niloofar", "09121110005"));
    await setStatus(loan.id, "returned");
    expect(await book(BLIND_OWL)).toMatchObject({ copies: 1, onLoan: 0 });
  });
});

import { describe, expect, it } from "vitest";

import { GET as exportJournal } from "@/app/api/admin/accounting/journal/export/route";
import { GET as printJournal } from "@/app/api/admin/accounting/journal/print/route";
import { POST as postEntry } from "@/app/api/admin/accounting/journal/route";
import { GET as exportReport } from "@/app/api/admin/accounting/reports/[report]/export/route";
import { GET as getReport } from "@/app/api/admin/accounting/reports/[report]/route";
import type { PrintedJournal, ProfitAndLoss } from "@/src/domain/entities/AccountingReports";
import { cafeDayOf, shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { prisma } from "@/src/infrastructure/prisma/client";

import { getRequest, jsonRequest, readJson, routeParams } from "./helpers/http";
import { signInAs } from "./helpers/session";

const today = cafeDayOf(new Date());
const SPAN = `from=${shiftCafeDay(today, -30)}&to=${today}`;

async function post(description: string, amount: number, debitCode: string, creditCode: string): Promise<void> {
  const response = await postEntry(
    jsonRequest("POST", "/api/admin/accounting/journal", {
      date: today,
      description,
      lines: [
        { accountCode: debitCode, debit: String(amount), credit: "", memo: "" },
        { accountCode: creditCode, debit: "", credit: String(amount), memo: "" },
      ],
    }),
  );
  expect(response.status).toBe(201);
}

const report = (slug: string, query: string): Promise<Response> =>
  exportReport(getRequest(`/api/admin/accounting/reports/${slug}/export?${query}`), routeParams({ report: slug }));

const journal = (query: string): Promise<Response> =>
  exportJournal(getRequest(`/api/admin/accounting/journal/export?${query}`));

describe("exporting a statement", () => {
  it("is for the books' readers", async () => {
    expect((await report("trial-balance", "")).status).toBe(401);

    signInAs("staff");
    expect((await report("trial-balance", "")).status).toBe(401);
  });

  it("answers 404 for a statement that doesn't exist", async () => {
    signInAs("admin");

    expect((await report("secrets", "")).status).toBe(404);
  });

  it("answers 400 for a span that runs backwards", async () => {
    signInAs("admin");

    expect((await report("vat", `from=${today}&to=${shiftCafeDay(today, -1)}`)).status).toBe(400);
  });

  it("downloads as a file that nothing keeps a copy of", async () => {
    signInAs("admin");
    const response = await report("profit-and-loss", SPAN);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename="profit-and-loss-${shiftCafeDay(today, -30)}-to-${today}.csv"`,
    );
  });

  it("carries the same figures the statement shows", async () => {
    signInAs("admin");
    await post("Drinks sold", 900_000, "1110", "4100");
    await post("Rent", 300_000, "6100", "1110");

    const statement = await readJson<ProfitAndLoss>(
      await getReport(
        getRequest(`/api/admin/accounting/reports/profit-and-loss?${SPAN}`),
        routeParams({ report: "profit-and-loss" }),
      ),
    );
    const csv = await (await report("profit-and-loss", SPAN)).text();

    expect(csv).toContain(`,Total revenue,${statement.revenue.total}\r\n`);
    expect(csv).toContain(`,Net profit,${statement.netProfit}\r\n`);
  });

  it("speaks the reader's language", async () => {
    signInAs("admin");
    await post("Drinks sold", 900_000, "1110", "4100");

    const bytes = new Uint8Array(await (await report("trial-balance", `asOf=${today}&locale=fa`)).arrayBuffer());

    // Read as bytes: `Response.text()` drops a BOM, and Excel needs it there.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes)).toContain("تراز آزمایشی");
  });

  it.each(["balance-sheet", "trial-balance"])("builds %s as of a day", async (slug) => {
    signInAs("admin");
    const response = await report(slug, `asOf=${today}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain(`${slug}-${today}.csv`);
  });

  it.each(["vat", "margins"])("builds %s over a span", async (slug) => {
    signInAs("admin");

    expect((await report(slug, SPAN)).status).toBe(200);
  });
});

describe("exporting the journal", () => {
  it("is for the books' readers", async () => {
    expect((await journal("")).status).toBe(401);

    signInAs("staff");
    expect((await journal("")).status).toBe(401);
  });

  it("writes every line of every entry in the span, past any page size, in order", async () => {
    signInAs("admin");
    const base = await prisma.journalEntry.count();
    await seedEntries(120);

    const csv = await (await journal(SPAN)).text();
    const rows = csv.trimEnd().split("\r\n").slice(1);

    expect(rows).toHaveLength((base + 120) * 2);
    const numbers = rows.map((row) => Number(row.split(",")[0].replace("JE-", "")));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(base + 120);
  });

  it("reads past a batch boundary without repeating or dropping an entry", async () => {
    signInAs("admin");
    const base = await prisma.journalEntry.count();
    await seedEntries(501);

    const csv = await (await journal(SPAN)).text();
    const numbers = csv
      .trimEnd()
      .split("\r\n")
      .slice(1)
      .map((row) => row.split(",")[0]);

    expect(new Set(numbers).size).toBe(base + 501);
    expect(numbers).toHaveLength((base + 501) * 2);
  });

  it("keeps to the span and the filters", async () => {
    signInAs("admin");
    await post("Rent", 300_000, "6100", "1110");

    const outside = await (await journal(`from=2000-01-01&to=2000-01-31`)).text();
    expect(outside.trimEnd().split("\r\n")).toHaveLength(1);

    const bySource = await (await journal(`${SPAN}&source=income`)).text();
    expect(bySource).not.toContain("Rent");

    const manual = await (await journal(`${SPAN}&source=manual`)).text();
    expect(manual).toContain("Rent");
  });

  it("defuses a description that would run as a formula", async () => {
    signInAs("admin");
    await post('=HYPERLINK("http://evil.example")', 1000, "6100", "1110");

    const csv = await (await journal(SPAN)).text();

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"")"`);
  });
});

describe("the journal's print view", () => {
  const print = (query: string): Promise<Response> =>
    printJournal(getRequest(`/api/admin/accounting/journal/print?${query}`));

  it("is for the books' readers", async () => {
    expect((await print("")).status).toBe(401);

    signInAs("staff");
    expect((await print("")).status).toBe(401);
  });

  it("carries the whole period, oldest first, past the screen's page size", async () => {
    signInAs("admin");
    const base = await prisma.journalEntry.count();
    await seedEntries(120);

    const response = await print(SPAN);
    expect(response.status).toBe(200);
    const journal = await readJson<PrintedJournal>(response);

    expect(journal.total).toBe(base + 120);
    expect(journal.entries).toHaveLength(base + 120);
    expect(journal.entries[1].number).toBeGreaterThan(journal.entries[0].number);
    expect(journal.entries[0].lines.length).toBeGreaterThan(0);
  });

  it("keeps to the source it was opened with", async () => {
    signInAs("admin");
    await post("Rent", 300_000, "6100", "1110");

    const journal = await readJson<PrintedJournal>(await print(`${SPAN}&source=income`));

    expect(journal.entries.map((entry) => entry.description)).not.toContain("Rent");
  });

  it("answers 400 for a span that runs backwards", async () => {
    signInAs("admin");

    expect((await print(`from=${today}&to=${shiftCafeDay(today, -1)}`)).status).toBe(400);
  });
});

/** Entries directly, so the batch tests don't pay for hundreds of API calls. */
async function seedEntries(count: number): Promise<void> {
  const date = new Date(`${today}T00:00:00.000Z`);
  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < count; index += 1) {
      await tx.journalEntry.create({
        data: {
          date,
          description: `Seed ${index}`,
          source: "manual",
          createdById: "seed",
          createdByName: "Seed",
          lines: {
            create: [
              { position: 0, accountCode: "6100", debit: BigInt(1000), credit: BigInt(0) },
              { position: 1, accountCode: "1110", debit: BigInt(0), credit: BigInt(1000) },
            ],
          },
        },
      });
    }
  });
}

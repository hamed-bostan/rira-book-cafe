import { expect, request, test, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";
import { jalaliPeriod, toJalali } from "../src/domain/entities/JalaliCalendar";

import { E2E_BASE_URL } from "./fixtures/env";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Finance pages at a phone's, a tablet's and a laptop's width, in both
 * languages: nothing pushes the page sideways, tables fit without scrolling, and
 * the tab you're on is in view.
 *
 * The books are filled first with ten-digit figures and long descriptions — the
 * widest a cafe's real numbers get — so a layout that only fits small sums fails here.
 *
 * Pages that still fall short carry `knownGap`, naming the phase of the responsive
 * plan that fixes them: their check is expected to fail, and starts failing the run
 * the moment it passes, so the mark comes off with the fix.
 */

test.use({ storageState: storageStatePath("admin") });

const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

const PHONE = VIEWPORTS[0];

const LOCALES = ["fa", "en"] as const;

/** A figure as wide as a year's turnover gets. */
const BIG = "1250000000";

type Seed = {
  entryId: string;
  expenseId: string;
  statementId: string;
  payRunId: string;
  productId: string;
};

type FinancePage = {
  path: (seed: Seed) => string;
  /** Has a table that should fit the screen; a print layout's doesn't count. */
  table?: boolean;
  /** Has the row of tabs along its top. */
  tabs?: boolean;
  /** The phase that makes its tables fit, where they still scroll sideways today. */
  knownGap?: string;
  /** Something to do before measuring, like picking lines to match. */
  prepare?: (page: Page) => Promise<void>;
};

const PAGES: Record<string, FinancePage> = {
  "cash shifts": { path: () => "/dashboard/cash-shifts" },
  "accounting overview": { path: () => "/dashboard/accounting", tabs: true },
  journal: { path: () => "/dashboard/accounting/journal", tabs: true },
  "journal entry": {
    path: (seed) => `/dashboard/accounting/journal/${seed.entryId}`,
    table: true,
  },
  "journal print": { path: () => "/dashboard/accounting/journal/print" },
  "new journal entry": { path: () => "/dashboard/accounting/journal/new" },
  accounts: { path: () => "/dashboard/accounting/accounts", tabs: true },
  "bank ledger": { path: () => "/dashboard/accounting/accounts/1120", table: true },
  statements: { path: () => "/dashboard/accounting/statements", tabs: true },
  "profit and loss": { path: () => "/dashboard/accounting/statements/profit-and-loss" },
  "balance sheet": { path: () => "/dashboard/accounting/statements/balance-sheet" },
  "trial balance": {
    path: () => "/dashboard/accounting/statements/trial-balance",
    table: true,
  },
  vat: { path: () => "/dashboard/accounting/statements/vat" },
  // Its table only shows once something has sold, which a fresh database hasn't.
  margins: { path: () => "/dashboard/accounting/statements/margins" },
  "cash flow": { path: () => "/dashboard/accounting/statements/cash-flow" },
  "bank statements": {
    path: () => "/dashboard/accounting/bank",
    table: true,
    tabs: true,
  },
  "new bank statement": { path: () => "/dashboard/accounting/bank/new" },
  reconciliation: {
    path: (seed) => `/dashboard/accounting/bank/${seed.statementId}`,
    prepare: async (page) => {
      for (const side of [
        /^(On the statement, not in the books|در صورت‌حساب، نه در دفاتر)/,
        /^(In the books, not on the statement|در دفاتر، نه در صورت‌حساب)/,
      ]) {
        const list = page.locator("section").filter({ has: page.getByRole("heading", { name: side }) });
        await list.getByRole("checkbox").first().check();
      }
    },
  },
  "accounting settings": { path: () => "/dashboard/accounting/settings", tabs: true },
  income: { path: () => "/dashboard/income", tabs: true },
  expenses: { path: () => "/dashboard/expenses", tabs: true },
  expense: { path: (seed) => `/dashboard/expenses/${seed.expenseId}` },
  // Lands on the list with the form open, by way of a redirect.
  "new expense": {
    path: () => "/dashboard/expenses/new",
    prepare: async (page) => {
      await page.waitForURL(/\/dashboard\/expenses\?record=1$/);
      await page.getByRole("dialog").waitFor();
    },
  },
  "recurring bills": { path: () => "/dashboard/expenses/recurring" },
  suppliers: { path: () => "/dashboard/expenses/suppliers" },
  payroll: { path: () => "/dashboard/payroll" },
  "pay run": { path: (seed) => `/dashboard/payroll/${seed.payRunId}`, table: true, knownGap: "Phase 6" },
  employees: { path: () => "/dashboard/payroll/employees" },
  "new pay run": { path: () => "/dashboard/payroll/new" },
  pricing: { path: () => "/dashboard/pricing", table: true, tabs: true },
  ingredients: { path: () => "/dashboard/pricing/ingredients", table: true, tabs: true },
  recipe: { path: (seed) => `/dashboard/pricing/recipes/${seed.productId}` },
  "pricing settings": { path: () => "/dashboard/pricing/settings", tabs: true },
};

let seed: Seed;
let openShiftId: string | null = null;

/** The body of a call that has to succeed for the pages to have anything on them. */
async function jsonOf<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.url()} answered ${response.status()}: ${await response.text()}`).toBe(true);
  return (await response.json()) as T;
}

/**
 * Today's bank statement. Statements can't overlap, so setting up again on the same
 * day — a rerun on a kept database, or the worker starting over after a failure —
 * picks up the one already there.
 */
async function seedBankStatement(api: APIRequestContext, today: string): Promise<string> {
  const statements = await jsonOf<{ id: string; toDay: string }[]>(
    await api.get("/api/admin/accounting/bank-statements"),
  );
  const existing = statements.find((statement) => statement.toDay >= today);
  if (existing) return existing.id;

  const statement = await jsonOf<{ id: string }>(
    await api.post("/api/admin/accounting/bank-statements", {
      data: {
        fromDay: today,
        toDay: today,
        openingBalance: "0",
        closingBalance: "850000000",
        lines: [
          {
            date: today,
            description: "E2E transfer in from the owner's personal account for the reading room",
            reference: "TRX-2026-000184-77",
            amount: BIG,
          },
          {
            date: today,
            description: "E2E payment to the espresso machine service company",
            reference: "",
            amount: "-400000000",
          },
        ],
      },
    }),
  );
  return statement.id;
}

/**
 * A pay run with deductions, so it has the older, wider table. It's for this month
 * last year: a month has one run, and this one's is the payroll spec's to record.
 * The person on it is inactive, so that spec's new run doesn't pick them up either.
 */
async function seedPayRun(api: APIRequestContext, today: string, stamp: number): Promise<string> {
  const { jy, jm } = toJalali(today);
  const period = jalaliPeriod(jy - 1, jm);
  const runs = await jsonOf<{ id: string; period: string }[]>(await api.get("/api/admin/payroll/runs"));
  const existing = runs.find((run) => run.period === period);
  if (existing) return existing.id;

  const employee = await jsonOf<{ id: string }>(
    await api.post("/api/admin/payroll/employees", {
      data: {
        name: `E2E Shahrzad Mohammadi-Esfahani ${stamp}`,
        position: "",
        phone: "",
        monthlySalary: "",
        isActive: false,
      },
    }),
  );
  const run = await jsonOf<{ id: string }>(
    await api.post("/api/admin/payroll/runs", {
      data: {
        period,
        date: today,
        lines: [
          {
            employeeId: employee.id,
            gross: "950000000",
            employeeInsurance: "66500000",
            incomeTax: "120000000",
            employerInsurance: "190000000",
          },
        ],
      },
    }),
  );
  return run.id;
}

/** Ends whatever shift is open, then leaves one closed a little short and a new one open over the tests. */
async function seedCashShifts(api: APIRequestContext): Promise<void> {
  const { current } = await jsonOf<{ current: { shift: { id: string }; expectedCash: number } | null }>(
    await api.get("/api/admin/cash-shifts"),
  );
  if (current) {
    await jsonOf(
      await api.post(`/api/admin/cash-shifts/${current.shift.id}/close`, {
        data: { countedCash: current.expectedCash },
      }),
    );
  }
  const first = await jsonOf<{ id: string }>(
    await api.post("/api/admin/cash-shifts", { data: { openingFloat: 25_000_000 } }),
  );
  await jsonOf(
    await api.post(`/api/admin/cash-shifts/${first.id}/close`, {
      data: { countedCash: 24_500_000, note: "E2E counted twice at the end of a long evening" },
    }),
  );
  const open = await jsonOf<{ id: string }>(
    await api.post("/api/admin/cash-shifts", { data: { openingFloat: 25_000_000 } }),
  );
  openShiftId = open.id;
}

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const today = cafeDayOf(new Date());
  const stamp = Date.now();

  const supplier = await jsonOf<{ id: string }>(
    await api.post("/api/admin/suppliers", {
      data: { name: `E2E Espresso Machine Services ${stamp}`, phone: "021 8800 1234", note: "", isActive: true },
    }),
  );
  const expense = await jsonOf<{ id: string }>(
    await api.post("/api/admin/expenses", {
      data: {
        date: today,
        supplierId: supplier.id,
        accountCode: "6100",
        description: `E2E quarterly service contract for the espresso machine and grinders ${stamp}`,
        amount: BIG,
        vatAmount: "",
        payment: "unpaid",
      },
    }),
  );
  await jsonOf(
    await api.post(`/api/admin/expenses/${expense.id}/pay`, {
      data: { source: "bank", paidOn: today, amount: "400000000" },
    }),
  );

  await jsonOf(
    await api.post("/api/admin/income", {
      data: {
        date: today,
        accountCode: "4900",
        description: `E2E venue hire for the autumn book festival, three evenings ${stamp}`,
        amount: BIG,
        vatAmount: "",
        method: "transfer",
        payerName: "E2E Autumn Book Festival Organising Committee",
      },
    }),
  );

  const entry = await jsonOf<{ id: string }>(
    await api.post("/api/admin/accounting/journal", {
      data: {
        date: today,
        description: `E2E owner's capital paid into the bank for the new reading room ${stamp}`,
        lines: [
          { accountCode: "1120", debit: BIG, credit: "", memo: "Transfer from the owner's personal account" },
          { accountCode: "3100", debit: "", credit: BIG, memo: "Capital for the reading room fit-out" },
        ],
      },
    }),
  );

  const statementId = await seedBankStatement(api, today);
  const payRunId = await seedPayRun(api, today, stamp);

  await jsonOf(
    await api.post("/api/admin/ingredients", {
      data: {
        name: `E2E single-origin Ethiopian espresso beans ${stamp}`,
        unit: "g",
        purchasePrice: "8500000",
        purchaseQuantity: "1000",
        isActive: true,
      },
    }),
  );
  const pricing = await jsonOf<{ rows: { productId: string }[] }>(await api.get("/api/admin/pricing"));

  await seedCashShifts(api);
  await api.dispose();

  seed = {
    entryId: entry.id,
    expenseId: expense.id,
    statementId,
    payRunId,
    productId: pricing.rows[0].productId,
  };
});

test.afterAll(async () => {
  if (!openShiftId) return;
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const { current } = (await (await api.get("/api/admin/cash-shifts")).json()) as {
    current: { shift: { id: string }; expectedCash: number } | null;
  };
  if (current?.shift.id === openShiftId) {
    await api.post(`/api/admin/cash-shifts/${openShiftId}/close`, { data: { countedCash: current.expectedCash } });
  }
  await api.dispose();
});

/**
 * Opens a page at a phone's width, with its fonts in, so text is measured at its
 * real size. `document.fonts.ready` alone can settle before a face has even started
 * loading, leaving the fallback font's narrower text on screen, so every declared
 * face is loaded first.
 */
async function open(page: Page, financePage: FinancePage): Promise<void> {
  await page.setViewportSize(PHONE);
  await page.goto(financePage.path(seed));
  await page.evaluate(async () => {
    await Promise.allSettled([...document.fonts].map((face) => face.load()));
    await document.fonts.ready;
  });
  await financePage.prepare?.(page);
}

/** How far the page reaches past the screen's edge, and the first few things doing it. */
function measurePageOverflow(): { by: number; culprits: string[] } {
  const root = document.documentElement;
  const edge = root.clientWidth;
  const by = root.scrollWidth - edge;
  if (by <= 0) return { by: 0, culprits: [] };

  // Something inside a scroller or a clipped box can't push the page out.
  const contained = (element: Element): boolean => {
    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== "visible") return true;
    }
    return false;
  };
  const culprits = [...document.body.querySelectorAll("*")]
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.right > edge + 1 || box.left < -1) && !contained(element);
    })
    .slice(0, 3)
    .map(
      (element) =>
        `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}"> ${(element.textContent ?? "").trim().slice(0, 80)}`,
    );
  return { by, culprits };
}

/**
 * The figures broken across two lines. The page lets any long word wrap anywhere
 * rather than spill over, so a number too wide for its box splits instead of
 * pushing the page out — readable to nobody.
 */
function measureBrokenFigures(): string[] {
  const FIGURE = /^[+\-−‎‏؜]*[\d۰-۹][\d۰-۹,٬.٫‎‏؜]{3,}%?$/;
  const broken: string[] = [];
  const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").trim();
    if (!FIGURE.test(text)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const lines = new Set([...range.getClientRects()].map((box) => Math.round(box.top)));
    if (lines.size > 1) broken.push(text);
  }
  return broken;
}

/** How far each visible table scrolls sideways inside its card. */
function measureSidewaysTables(): number[] {
  return [...document.querySelectorAll("main table")].flatMap((table) => {
    if (!table.checkVisibility()) return [];
    let scroller = table.parentElement;
    while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) {
      scroller = scroller.parentElement;
    }
    const by = scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
    return by > 1 ? [by] : [];
  });
}

/** Whether the tab for the page on screen is cut off by its row's edge. */
function measureCurrentTabHidden(): boolean {
  const tab = document.querySelector('main nav a[aria-current="page"]');
  const row = tab?.closest("nav");
  if (!tab || !row) return false;
  const tabBox = tab.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  return tabBox.left < rowBox.left - 1 || tabBox.right > rowBox.right + 1;
}

for (const locale of LOCALES) {
  test.describe(`in ${locale}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: E2E_BASE_URL }]);
    });

    for (const [name, financePage] of Object.entries(PAGES)) {
      test(`${name} fits the screen at every width`, async ({ page }) => {
        await open(page, financePage);

        const overflows: { width: number; by: number; culprits: string[] }[] = [];
        const broken: { width: number; figures: string[] }[] = [];
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const { by, culprits } = await page.evaluate(measurePageOverflow);
          if (by > 0) overflows.push({ width: viewport.width, by, culprits });
          const figures = await page.evaluate(measureBrokenFigures);
          if (figures.length > 0) broken.push({ width: viewport.width, figures });
        }
        expect.soft(overflows, "the page scrolls sideways").toEqual([]);
        expect.soft(broken, "a figure splits across lines").toEqual([]);
      });

      if (financePage.table) {
        test(`${name} keeps its tables on screen`, async ({ page }) => {
          test.fail(Boolean(financePage.knownGap), `${financePage.knownGap} fits this page's tables`);
          await open(page, financePage);

          const scrolling: { width: number; by: number[] }[] = [];
          for (const viewport of VIEWPORTS) {
            await page.setViewportSize(viewport);
            const by = await page.evaluate(measureSidewaysTables);
            if (by.length > 0) scrolling.push({ width: viewport.width, by });
          }
          expect(scrolling, "a table scrolls sideways").toEqual([]);
        });
      }

      if (financePage.tabs) {
        test(`${name} shows the tab it's on`, async ({ page }) => {
          await open(page, financePage);

          expect(await page.evaluate(measureCurrentTabHidden), "the current tab is off the edge").toBe(false);
        });
      }
    }
  });
}

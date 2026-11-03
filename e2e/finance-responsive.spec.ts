import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";
import { jalaliPeriod, toJalali } from "../src/domain/entities/JalaliCalendar";

import { E2E_BASE_URL } from "./fixtures/env";
import {
  jsonOf,
  LOCALES,
  measureBrokenFigures,
  measureCurrentTabHidden,
  measurePageOverflow,
  measureSidewaysTables,
  measureSmallTargets,
  measureSpilledFigures,
  openWithFonts,
  PHONE,
  VIEWPORTS,
} from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Finance pages at a phone's, a tablet's and a laptop's width, in both
 * languages: nothing pushes the page sideways, no figure splits or runs into the
 * next column, tables fit without scrolling, the tab you're on is in view, and on
 * a phone every control is big enough for a finger.
 *
 * The books are filled first with ten-digit figures and long descriptions — the
 * widest a cafe's real numbers get — so a layout that only fits small sums fails here.
 */

test.use({ storageState: storageStatePath("admin") });

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
  /** Opens a dialog, which is measured rather than the page under it. */
  dialog?: boolean;
  /** Something to do before measuring, like picking lines to match. */
  prepare?: (page: Page) => Promise<void>;
};

/** The open dialog, once it has finished zooming in: mid-animation it's drawn smaller than it is. */
async function openedDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.evaluate((element) =>
    Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
}

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
    // A line picked on each side, so the bar's totals are as wide as they get. On a
    // phone one side shows at a time, so each is brought up by its tab first.
    prepare: async (page) => {
      for (const [tab, side] of [
        [/^(Statement|صورت‌حساب)/, /^(On the statement, not in the books|در صورت‌حساب، نه در دفاتر)/],
        [/^(Books|دفاتر)/, /^(In the books, not on the statement|در دفاتر، نه در صورت‌حساب)/],
      ]) {
        const switcher = page.getByRole("tab", { name: tab });
        if (await switcher.isVisible()) await switcher.click();
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
    dialog: true,
    prepare: async (page) => {
      await page.waitForURL(/\/dashboard\/expenses\?record=1$/);
      await openedDialog(page);
    },
  },
  "recurring bills": { path: () => "/dashboard/expenses/recurring" },
  suppliers: { path: () => "/dashboard/expenses/suppliers" },
  payroll: { path: () => "/dashboard/payroll" },
  "pay run": { path: (seed) => `/dashboard/payroll/${seed.payRunId}`, table: true },
  employees: { path: () => "/dashboard/payroll/employees" },
  "new pay run": { path: () => "/dashboard/payroll/new" },
  pricing: { path: () => "/dashboard/pricing", table: true, tabs: true },
  ingredients: { path: () => "/dashboard/pricing/ingredients", table: true, tabs: true },
  recipe: { path: (seed) => `/dashboard/pricing/recipes/${seed.productId}` },
  "pricing settings": { path: () => "/dashboard/pricing/settings", tabs: true },
};

let seed: Seed;
let openShiftId: string | null = null;

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
async function seedPayRun(api: APIRequestContext, today: string, stamp: string): Promise<string> {
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

/** The seeded supplier's name, before the stamp that tells one seed's rows from another's. */
const SUPPLIER = "E2E Espresso Machine Services";

/** The owner's capital entry's description, before the same stamp. */
const CAPITAL = "E2E owner's capital paid into the bank for the new reading room";

/**
 * A supplier's bill part-paid from the bank, venue hire paid in by transfer, the
 * owner's capital posted by hand, and an ingredient — once per database. A failed
 * test starts a fresh worker, which runs this again: it finds the supplier already
 * there and picks up the bill and the entry seeded with it, rather than paying
 * another bill from the bank (a second line the matching test can't tell apart).
 */
async function seedBooks(
  api: APIRequestContext,
  today: string,
  stamp: string,
): Promise<{ expenseId: string; entryId: string }> {
  const suppliers = await jsonOf<{ id: string; name: string }[]>(await api.get("/api/admin/suppliers?all=true"));
  const seeded = suppliers.find((supplier) => supplier.name.startsWith(`${SUPPLIER} `));
  if (seeded) {
    const seededStamp = seeded.name.slice(SUPPLIER.length + 1);
    const expenses = await jsonOf<{ items: { id: string }[] }>(
      await api.get(`/api/admin/expenses?supplier=${seeded.id}`),
    );
    const entries = await jsonOf<{ items: { id: string; description: string }[] }>(
      await api.get("/api/admin/accounting/journal?source=manual&account=3100"),
    );
    const entry = entries.items.find((item) => item.description === `${CAPITAL} ${seededStamp}`);
    if (!entry) throw new Error(`The seeded capital entry for ${seeded.name} isn't in the journal.`);
    return { expenseId: expenses.items[0].id, entryId: entry.id };
  }

  const supplier = await jsonOf<{ id: string }>(
    await api.post("/api/admin/suppliers", {
      data: { name: `${SUPPLIER} ${stamp}`, phone: "021 8800 1234", note: "", isActive: true },
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
        description: `${CAPITAL} ${stamp}`,
        lines: [
          { accountCode: "1120", debit: BIG, credit: "", memo: "Transfer from the owner's personal account" },
          { accountCode: "3100", debit: "", credit: BIG, memo: "Capital for the reading room fit-out" },
        ],
      },
    }),
  );

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

  return { expenseId: expense.id, entryId: entry.id };
}

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const today = cafeDayOf(new Date());
  // Tells this run's rows apart, in letters and digits so a name doesn't end in what reads as a figure.
  const stamp = Date.now().toString(36);

  const { expenseId, entryId } = await seedBooks(api, today, stamp);
  const statementId = await seedBankStatement(api, today);
  const payRunId = await seedPayRun(api, today, stamp);
  const pricing = await jsonOf<{ rows: { productId: string }[] }>(await api.get("/api/admin/pricing"));

  await seedCashShifts(api);
  await api.dispose();

  seed = { entryId, expenseId, statementId, payRunId, productId: pricing.rows[0].productId };
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

/** Opens a page at a phone's width with its fonts in, then readies it for measuring. */
async function open(page: Page, financePage: FinancePage): Promise<void> {
  await openWithFonts(page, financePage.path(seed));
  await financePage.prepare?.(page);
}

for (const locale of LOCALES) {
  test.describe(`in ${locale}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: E2E_BASE_URL }]);
    });

    for (const [name, financePage] of Object.entries(PAGES)) {
      const root = financePage.dialog ? '[role="dialog"]' : "main";

      test(`${name} fits the screen at every width`, async ({ page }) => {
        await open(page, financePage);

        const overflows: { width: number; by: number; culprits: string[] }[] = [];
        const broken: { width: number; figures: string[] }[] = [];
        const spilled: { width: number; figures: string[] }[] = [];
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const { by, culprits } = await page.evaluate(measurePageOverflow);
          if (by > 0) overflows.push({ width: viewport.width, by, culprits });
          const split = await page.evaluate(measureBrokenFigures, root);
          if (split.length > 0) broken.push({ width: viewport.width, figures: split });
          const over = await page.evaluate(measureSpilledFigures, root);
          if (over.length > 0) spilled.push({ width: viewport.width, figures: over });
        }
        expect.soft(overflows, "the page scrolls sideways").toEqual([]);
        expect.soft(broken, "a figure splits across lines").toEqual([]);
        expect.soft(spilled, "a figure runs out of its column").toEqual([]);
      });

      test(`${name} has controls a finger can hit on a phone`, async ({ page }) => {
        await open(page, financePage);

        expect(await page.evaluate(measureSmallTargets, root), "a control is under 44px").toEqual([]);
      });

      if (financePage.table) {
        test(`${name} keeps its tables on screen`, async ({ page }) => {
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

test("on a phone, matching shows one side at a time, keeps what's picked, and keeps Match in reach", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto(`/dashboard/accounting/bank/${seed.statementId}`);

  const statementTab = page.getByRole("tab", { name: /^Statement/ });
  const booksTab = page.getByRole("tab", { name: /^Books/ });
  const bankSide = page.locator("section").filter({ has: page.getByRole("heading", { name: /^On the statement/ }) });
  const bookSide = page.locator("section").filter({ has: page.getByRole("heading", { name: /^In the books/ }) });
  const payment = "E2E payment to the espresso machine service company";
  const bankLine = page.getByRole("checkbox", { name: `Pick ${payment}` });

  await expect(bookSide).toBeHidden();

  // At every width a line's description gets most of the row, and the date line
  // under it room to read, whether the amount sits beside the description or under it.
  const squeezed: { width: number; description: number; reference: number; list: number }[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    const list = (await bankSide.boundingBox())!.width;
    const description = (await bankSide.getByText(payment, { exact: true }).boundingBox())!.width;
    const reference = (await bankSide.getByText("TRX-2026-000184-77").boundingBox())!.width;
    if (description < list * 0.5 || reference < 64)
      squeezed.push({ width: viewport.width, description, reference, list });
  }
  expect(squeezed, "a line's description or date line is squeezed").toEqual([]);
  await page.setViewportSize(PHONE);

  await bankLine.check();
  await booksTab.click();
  await expect(bankSide).toBeHidden();
  await bookSide.getByRole("listitem").filter({ hasText: "-400,000,000" }).getByRole("checkbox").check();
  await statementTab.click();
  await expect(bankLine).toBeChecked();

  // The same amount picked on both sides, so it can be matched, from the bar along
  // the foot of the screen that the phone's tab bar mustn't cover.
  await page.evaluate(() => window.scrollTo(0, 0));
  const match = page.getByRole("button", { name: "Match", exact: true });
  await expect(match).toBeEnabled();
  await expect(match).toBeInViewport();
  const covered = await match.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !(hit && button.contains(hit));
  });
  expect(covered, "the Match button is under the tab bar").toBe(false);
});

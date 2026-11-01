import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.use({ storageState: storageStatePath("admin") });

/** Whether nothing of the dashboard's chrome or controls is left on paper. */
async function expectPrintsAsADocument(page: Page, heading: string): Promise<void> {
  await page.emulateMedia({ media: "print" });

  await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page.locator("header").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Print", exact: true })).toBeHidden();
  await expect(page.getByRole("link", { name: "Export CSV" })).toBeHidden();
  await expect(page.getByText("Rira Book Cafe ·")).toBeVisible();
}

test("a statement prints as a document at paper width, with its dates", async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.goto("/dashboard/accounting/statements/trial-balance");

  await expectPrintsAsADocument(page, "Trial balance");
  await expect(page.getByLabel("As of")).toBeHidden();
});

test("the cash-flow statement is on offer, and shows how the period's cash ended", async ({ page }) => {
  await page.goto("/dashboard/accounting/statements");
  await page.getByRole("link", { name: /^Cash flow/ }).click();

  await expect(page).toHaveURL(/\/statements\/cash-flow$/);
  await expect(page.getByRole("heading", { name: "Cash flow", exact: true })).toBeVisible();
  await expect(page.getByText("Opening cash plus the net change equals the cash in the books.")).toBeVisible();
  await expect(page.getByText("Cash at the end")).toBeVisible();
});

test("a statement downloads as a file", async ({ page }) => {
  await page.goto("/dashboard/accounting/statements/profit-and-loss");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Export CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^profit-and-loss-.+\.csv$/);
});

test("the journal has a print view of a whole period, reached from the journal", async ({ page }) => {
  await page.goto("/dashboard/accounting/journal");
  await page.getByRole("link", { name: "Print or export" }).click();

  await expect(page).toHaveURL(/\/dashboard\/accounting\/journal\/print$/);
  await page.setViewportSize({ width: 794, height: 1123 });
  await expectPrintsAsADocument(page, "Journal");
});

/** The smallest valid PNG: a 1×1 transparent pixel. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("a receipt goes on an expense, shows on its page, and stays private", async ({ page, playwright, baseURL }) => {
  const description = `E2E electricity ${Date.now()}`;

  await page.goto("/dashboard/expenses");
  await page.getByRole("button", { name: "Record expense" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Booked to").selectOption({ index: 1 });
  await dialog.getByLabel("Total (VAT included)").fill("1100000");
  await dialog.getByLabel("Receipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: PIXEL });
  await expect(dialog.getByRole("button", { name: "Replace" })).toBeVisible();
  await dialog.getByRole("button", { name: "Record expense" }).click();

  await page.getByRole("link", { name: description }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/expenses\/[^/?]+$/);

  const receipt = page.getByRole("img", { name: "The expense's receipt" });
  await expect(receipt).toBeVisible();
  await expect.poll(() => receipt.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);

  const src = (await receipt.getAttribute("src")) ?? "";
  expect(src).toMatch(/^\/uploads\/receipts\//);
  const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  expect((await anonymous.get(src)).status()).toBe(404);
  await anonymous.dispose();
});

test("the suppliers page shows what's left to pay, part payments taken off", async ({ page }) => {
  const name = `E2E Supplier ${Date.now()}`;
  const supplier = await page.request.post("/api/admin/suppliers", {
    data: { name, phone: "", note: "", isActive: true },
  });
  const { id } = (await supplier.json()) as { id: string };
  const today = new Date().toISOString().slice(0, 10);
  const bill = await page.request.post("/api/admin/expenses", {
    data: {
      date: today,
      supplierId: id,
      accountCode: "6100",
      description: "Part-paid bill",
      amount: "1000000",
      vatAmount: "",
      payment: "unpaid",
    },
  });
  const { id: billId } = (await bill.json()) as { id: string };
  await page.request.post(`/api/admin/expenses/${billId}/pay`, {
    data: { source: "bank", paidOn: today, amount: "400000" },
  });

  await page.goto("/dashboard/expenses/suppliers");

  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row.getByRole("link", { name: /^See what's owed to/ })).toHaveText(/600,000/);
  await expect(row.getByText("1 unpaid bill")).toBeVisible();
});

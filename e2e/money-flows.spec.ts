import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.use({ storageState: storageStatePath("admin") });

/** Open an order from the list by its number. */
async function openOrder(page: Page, number: string): Promise<void> {
  await page.goto(`/dashboard/orders?q=${number}`);
  await page
    .getByRole("link", { name: `View order #${number}`, exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[^/?]+$/);
}

test("staff ring up a split sale at the counter, then refund part of it", async ({ page }) => {
  await page.goto("/dashboard/orders");
  await page.getByRole("link", { name: "New sale" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/new$/);

  const espresso = page.getByRole("button", { name: "Add Espresso", exact: true });
  await espresso.click();
  await espresso.click();

  // Every sale is a guest's: one the cafe hasn't met gets a profile with it.
  await page.getByLabel("Guest's phone").fill(`0938${String(Date.now()).slice(-7)}`);
  await expect(page.getByRole("status").filter({ hasText: "New guest" })).toBeVisible();
  await page.getByLabel("Guest's name").fill("E2E Split Sale Guest");

  await page.getByRole("button", { name: "Split", exact: true }).click();
  await page.getByLabel("Cash", { exact: true }).fill("90000");
  await page.getByLabel("Card (POS)", { exact: true }).fill("100000");
  await expect(page.getByText("Adds up to the total.")).toBeVisible();

  await page.getByRole("button", { name: "Record sale" }).click();
  // The toast and its screen-reader announcement carry the same words.
  const toast = page.getByText(/Sale recorded as order #\d+/).first();
  await expect(toast).toBeVisible();
  const number = (await toast.textContent())?.match(/#(\d+)/)?.[1] ?? "";
  // The screen resets for the next guest.
  await expect(page.getByText("Pick items from the menu.")).toBeVisible();

  await openOrder(page, number);
  await expect(page.getByText(/Paid · Card .* \+ Cash /)).toBeVisible();

  await page.getByRole("button", { name: "Refund", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("How many of Espresso to refund").selectOption("1");
  await expect(dialog.getByText(/goes back to the guest/)).toBeVisible();
  await dialog.getByRole("button", { name: "Refund", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Refunds" })).toBeVisible();
  await expect(page.getByText(/^R-\d+ · /)).toBeVisible();
  await expect(page.getByText("1 refunded")).toBeVisible();
});

test("the books take income from outside an order, and void it", async ({ page }) => {
  const description = `E2E room hire ${Date.now()}`;

  await page.goto("/dashboard/income");
  await page.getByRole("button", { name: "Record income" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Booked to").selectOption({ label: "4900 · Other income" });
  await dialog.getByLabel("Total (VAT included)").fill("1100000");
  // The VAT inside the total fills itself in at the cafe's 10%.
  await expect(dialog.getByLabel("VAT inside it")).toHaveValue("100000");
  await dialog.getByRole("button", { name: "Record income" }).click();

  const row = page.getByRole("listitem").filter({ hasText: description });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Void" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Void income" }).click();
  await expect(row.getByText("Void", { exact: true })).toBeVisible();
});

test("a bill is paid off in parts", async ({ page }) => {
  const description = `E2E rent ${Date.now()}`;

  await page.goto("/dashboard/expenses");
  await page.getByRole("button", { name: "Record expense" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Booked to").selectOption({ label: "6100 · Rent" });
  await dialog.getByLabel("Total (VAT included)").fill("1000000");
  await dialog.getByRole("button", { name: "Record expense" }).click();

  await page.getByRole("link", { name: description }).click();
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  const pay = page.getByRole("dialog");
  await pay.getByLabel("Amount").fill("300000");
  await pay.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/300,000 .*paid, 700,000 .*left/)).toBeVisible();

  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/^Paid from/)).toBeVisible();
});

test("a deposit left against a book shows on the loan", async ({ page }) => {
  await page.goto("/dashboard/book-loans");
  await page.getByRole("button", { name: "Lend a book" }).click();
  const dialog = page.getByRole("dialog");
  // A book with a copy on the shelf: another spec may have lent every copy of one.
  const book = dialog.getByRole("combobox").first();
  await book.selectOption((await book.locator("option:not([disabled])").first().getAttribute("value")) ?? "");
  await dialog.getByLabel("Borrower's name").fill("Sara Ahmadi");
  await dialog.getByLabel("Borrower's phone").fill("09121234567");
  await dialog.getByLabel("Deposit (optional)").fill("500000");
  await expect(dialog.getByLabel("Paid into")).toBeVisible();
  await dialog.getByRole("button", { name: "Record loan" }).click();

  await expect(page.getByText(/Deposit held: 500,000/)).toBeVisible();
});

test("a dialog opens on screen in Persian, on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fa/dashboard/income");
  await page.getByRole("button", { name: "ثبت درآمد" }).click();

  const box = await page.getByRole("dialog").boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  // Back to English, so the locale cookie doesn't follow later specs.
  await page.goto("/en/dashboard/income");
});

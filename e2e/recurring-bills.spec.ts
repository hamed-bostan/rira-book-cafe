import { expect, test, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";
import { toJalali } from "../src/domain/entities/JalaliCalendar";

import { storageStatePath } from "./fixtures/sessions";

test.use({ storageState: storageStatePath("admin") });

/** Set up through the API with today as its day, so this month's has just fallen due. */
async function billDueToday(page: Page, description: string): Promise<void> {
  const response = await page.request.post("/api/admin/recurring-bills", {
    data: {
      description,
      accountCode: "6100",
      supplierId: "",
      amount: "30000000",
      vatAmount: "",
      dayOfMonth: toJalali(cafeDayOf(new Date())).jd,
      isActive: true,
    },
  });
  expect(response.status()).toBe(201);
}

test("a bill waits for a person, who checks the figures and records it", async ({ page }) => {
  const description = `E2E rent ${Date.now()}`;
  await billDueToday(page, description);

  await page.goto("/dashboard/expenses");
  const panel = page.getByRole("heading", { name: "Bills due" }).locator("xpath=ancestor::section");
  const row = panel.getByRole("listitem").filter({ hasText: description });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: /^Record / }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Total (VAT included)")).toHaveValue("30000000");
  await dialog.getByLabel("Total (VAT included)").fill("31500000");
  await dialog.getByRole("button", { name: "Record expense" }).click();

  await expect(page.getByText(/Expense EX-\d+ recorded/).first()).toBeVisible();
  await expect(row).toBeHidden();
  await expect(page.getByRole("link", { name: new RegExp(description) }).first()).toBeVisible();
});

test("a month that doesn't apply is skipped, after asking, and nothing is booked", async ({ page }) => {
  const description = `E2E service ${Date.now()}`;
  await billDueToday(page, description);

  await page.goto("/dashboard/expenses");
  const row = page.getByRole("listitem").filter({ hasText: description });
  await row.getByRole("button", { name: /^Skip / }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Skip this month" }).click();

  await expect(row).toBeHidden();
  await expect(page.getByRole("link", { name: new RegExp(description) })).toHaveCount(0);
});

test("recurring bills are set up from their own page", async ({ page }) => {
  const description = `E2E internet ${Date.now()}`;

  await page.goto("/dashboard/expenses");
  await page.getByRole("link", { name: "Recurring bills" }).click();
  await expect(page).toHaveURL(/\/dashboard\/expenses\/recurring$/);

  await page.getByRole("button", { name: "Add bill" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Description").fill(description);
  await dialog.getByLabel("Booked to").selectOption({ index: 1 });
  await dialog.getByLabel("Due on day").selectOption("15");
  await dialog.getByLabel("Total (VAT included)").fill("2500000");
  await dialog.getByRole("button", { name: "Save" }).click();

  const row = page.getByRole("listitem").filter({ hasText: description });
  await expect(row).toBeVisible();
  await expect(row.getByText("Day 15 of each month")).toBeVisible();
});

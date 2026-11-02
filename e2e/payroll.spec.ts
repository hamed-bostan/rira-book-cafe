import { expect, test } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("a month's pay is recorded from the accountant's figures, then paid", async ({ page }) => {
    const name = `E2E Sara ${Date.now()}`;

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Payroll" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/payroll$/);

    await page.getByRole("link", { name: "Employees" }).click();
    await page.getByRole("button", { name: "Add employee" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Usual monthly gross").fill("20000000");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();

    await page.goto("/dashboard/payroll/new");
    await expect(page.getByLabel(`Gross pay, ${name}`)).toHaveValue("20000000");
    await page.getByLabel(`Insurance, employee's share, ${name}`).fill("1400000");
    await page.getByLabel(`Income tax, ${name}`).fill("600000");
    await page.getByLabel(`Insurance, employer's share, ${name}`).fill("4600000");
    await expect(page.getByText(/Net pay: 18,000,000/)).toBeVisible();
    await page.getByRole("button", { name: "Record pay run" }).click();

    await expect(page).toHaveURL(/\/dashboard\/payroll\/[^/]+$/);
    await expect(page.getByRole("cell", { name, exact: true })).toBeVisible();
    await expect(page.getByText("Not paid yet")).toBeVisible();

    await page.getByRole("button", { name: "Pay", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();

    await expect(page.getByText(/Paid from Bank on/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay", exact: true })).toBeHidden();
  });
});

test.describe("as floor staff", () => {
  test.use({ storageState: storageStatePath("staff") });

  test("payroll isn't offered, and its pages send them away", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Payroll" })).toHaveCount(0);

    await page.goto("/dashboard/payroll");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

import { expect, test } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("a month's pay is recorded from everyone's usual salary, then paid", async ({ page }) => {
    const name = `E2E Sara ${Date.now()}`;

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Payroll" }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/payroll$/);

    await page.getByRole("link", { name: "Employees" }).click();
    await page.getByRole("button", { name: "Add employee" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Usual monthly salary").fill("20000000");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();

    await page.goto("/dashboard/payroll/new");
    const salary = page.getByLabel(`Salary, ${name}`);
    await expect(salary).toHaveValue("20000000");
    await salary.fill("21000000");
    await page.getByRole("button", { name: "Record pay run" }).click();

    await expect(page).toHaveURL(/\/dashboard\/payroll\/[^/]+$/);
    await expect(page.getByRole("row").filter({ hasText: name })).toContainText("21,000,000");
    await expect(page.getByRole("columnheader", { name: "Income tax" })).toHaveCount(0);
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

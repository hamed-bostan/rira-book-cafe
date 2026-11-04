import { expect, test } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.describe("as floor staff", () => {
  test.use({ storageState: storageStatePath("staff") });

  test("the activity log offers no way into the books or payroll", async ({ page }) => {
    await page.goto("/dashboard/activity");

    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    await expect(page.locator("option", { hasText: "Products" })).toHaveCount(1);
    for (const hidden of ["Books", "Expenses", "Income", "Payroll", "Team access"]) {
      await expect(page.locator("option", { hasText: hidden })).toHaveCount(0);
    }
  });
});

test.describe("as an admin", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("the books are still there to filter by", async ({ page }) => {
    await page.goto("/dashboard/activity");

    // The area filter; the "What happened" filter names actions ("Payroll recorded") too.
    const area = page.getByLabel("Area");
    await expect(area.locator("option", { hasText: "Expenses" })).toHaveCount(1);
    await expect(area.locator("option", { hasText: "Payroll" })).toHaveCount(1);
    await expect(page.locator("option", { hasText: "Team access" })).toHaveCount(0);
  });
});

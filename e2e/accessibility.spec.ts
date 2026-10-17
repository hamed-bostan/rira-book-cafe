import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./fixtures/a11y";
import { storageStatePath } from "./fixtures/sessions";

/** Key pages, checked as the visitor who'd see them. */
const STOREFRONT_PAGES = [
  { label: "home", path: "/" },
  { label: "menu", path: "/menu" },
  { label: "menu item", path: "/menu/seed-espresso" },
  { label: "events", path: "/events" },
  { label: "sign in", path: "/login" },
];

const DASHBOARD_PAGES = [
  { label: "dashboard", path: "/dashboard" },
  { label: "dashboard products", path: "/dashboard/products" },
  { label: "product form", path: "/dashboard/products/create" },
  { label: "dashboard orders", path: "/dashboard/orders" },
];

test.describe("accessibility: storefront", () => {
  for (const { label, path } of STOREFRONT_PAGES) {
    test(label, async ({ page }, testInfo) => {
      await page.goto(path);
      await expectNoSeriousA11yViolations(page, testInfo, label);
    });
  }

  test.describe("signed in", () => {
    test.use({ storageState: storageStatePath("customer") });

    test("basket with an item", async ({ page }, testInfo) => {
      await page.goto("/menu");
      await page.getByRole("button", { name: "Add Espresso to basket" }).click();
      await page.goto("/basket");
      await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
      await expectNoSeriousA11yViolations(page, testInfo, "basket");
    });
  });
});

test.describe("accessibility: dashboard", () => {
  test.use({ storageState: storageStatePath("admin") });

  for (const { label, path } of DASHBOARD_PAGES) {
    test(label, async ({ page }, testInfo) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expectNoSeriousA11yViolations(page, testInfo, label);
    });
  }
});

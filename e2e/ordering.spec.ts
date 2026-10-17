import { expect, test } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

test.describe("ordering", () => {
  test("an anonymous visitor can fill a basket but must sign in to order", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: "Add Espresso to basket" }).click();
    await page.getByRole("link", { name: "Basket, 1 item" }).click();

    await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to order" })).toBeVisible();
  });

  test.describe("as a signed-in guest", () => {
    test.use({ storageState: storageStatePath("customer") });

    test("browses the menu, fills the basket and places an order the bar then sees", async ({ page, browser }) => {
      await page.goto("/menu");
      await page.getByRole("button", { name: "Add Espresso to basket" }).click();
      await page.getByRole("button", { name: "Add Cappuccino to basket" }).click();
      await page.getByRole("link", { name: "Basket, 2 items" }).click();

      await expect(page.getByRole("heading", { name: "Your basket" })).toBeVisible();
      await page.getByText("Takeaway", { exact: true }).click();
      await page.getByRole("button", { name: "Place order" }).click();

      await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
      await expect(page.getByText("Your order number")).toBeVisible();
      // The basket is emptied once the order is placed.
      await expect(page.getByRole("link", { name: "Basket, empty" })).toBeVisible();

      // The order lands in the staff queue.
      const staff = await browser.newContext({ storageState: storageStatePath("staff") });
      try {
        const queue = await staff.newPage();
        await queue.goto("/dashboard/orders");
        // The queue renders a card and a table row per order; whichever this viewport shows.
        await expect(queue.getByText("Test Guest").filter({ visible: true }).first()).toBeVisible();
      } finally {
        await staff.close();
      }
    });
  });
});

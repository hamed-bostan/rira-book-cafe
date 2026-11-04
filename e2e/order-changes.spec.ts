import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Changing an order after it's placed, from its page in the dashboard — a second
 * round, a line taken off, another table — and the bar display marking it; then
 * its receipt, printed from the dashboard and read by the guest whose order it is.
 */

type PlacedOrder = { id: string; orderNumber: number; items: { id: string; name: string }[] };

/** A guest's dine-in order at table 3, placed over the API as the signed-in guest. */
async function placeAsGuest(items: { productId: string; quantity: number }[]): Promise<PlacedOrder> {
  const guest: APIRequestContext = await request.newContext({
    baseURL: E2E_BASE_URL,
    storageState: storageStatePath("customer"),
  });
  try {
    return await jsonOf<PlacedOrder>(
      await guest.post("/api/orders", { data: { items, serviceType: "dineIn", tableLabel: "3" } }),
    );
  } finally {
    await guest.dispose();
  }
}

/** Made-to-order drinks from the seeded menu, so no test runs a shelf dry for the next. */
const ESPRESSO = "seed-espresso";
const CAPPUCCINO = "seed-cappuccino";

/** The order page's Items card: its lines, totals and the buttons that change them. */
function itemsSection(page: Page): Locator {
  return page
    .getByRole("main")
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Items", exact: true }) });
}

test.describe("changing an order from its page", () => {
  test.use({ storageState: storageStatePath("staff") });

  test("adds a round with a note, and the bar display marks the ticket and the new line", async ({ page }) => {
    const order = await placeAsGuest([{ productId: ESPRESSO, quantity: 1 }]);

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Add items", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add Cappuccino", exact: true }).click();
    await dialog.getByRole("button", { name: "One more Cappuccino" }).click();
    await dialog.getByRole("textbox", { name: "Note for Cappuccino" }).fill("Oat milk");
    await expect(dialog.getByText(/Adds 2 items/)).toBeVisible();
    await dialog.getByRole("button", { name: "Add to order" }).click();

    // The toast's title (its live region repeats it, prefixed).
    await expect(page.getByText(`Added to order #${order.orderNumber}`, { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    const items = itemsSection(page);
    await expect(items.getByText(/× Cappuccino$/)).toBeVisible();
    await expect(items.getByText("Oat milk")).toBeVisible();
    await expect(items.getByText(/^Added at /)).toBeVisible();
    await expect(page.getByText("Order changed", { exact: true })).toBeVisible();

    await page.goto("/dashboard/kitchen");
    const ticket = page.getByRole("article", { name: new RegExp(`^Order ${order.orderNumber},`) });
    await expect(ticket.getByText("Changed", { exact: true })).toBeVisible();
    await expect(ticket.getByText("Added", { exact: true })).toBeVisible();
  });

  test("takes a line off, and the total follows", async ({ page }) => {
    const order = await placeAsGuest([
      { productId: ESPRESSO, quantity: 2 },
      { productId: CAPPUCCINO, quantity: 1 },
    ]);

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Change items" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "How many Cappuccino" }).selectOption({ label: "Remove" });
    await expect(dialog.getByText(/Takes off 1 item/)).toBeVisible();
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(`Order #${order.orderNumber} updated`, { exact: true })).toBeVisible();
    await expect(itemsSection(page).getByText(/× Cappuccino$/)).toHaveCount(0);
    await expect(itemsSection(page).getByText(/× Espresso$/)).toBeVisible();
  });

  test("won't take every line off — that's a cancellation", async ({ page }) => {
    const order = await placeAsGuest([{ productId: ESPRESSO, quantity: 1 }]);

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Change items" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("combobox", { name: "How many Espresso" }).selectOption({ label: "Remove" });

    await expect(dialog.getByText(/cancel the order instead/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("moves the order to another table", async ({ page }) => {
    const order = await placeAsGuest([{ productId: ESPRESSO, quantity: 1 }]);

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Move", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "Table", exact: true }).fill("12");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText(`Order #${order.orderNumber} moved`, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByText("Table 12")).toBeVisible();
  });
});

test.describe("receipts", () => {
  test.describe("in the dashboard", () => {
    test.use({ storageState: storageStatePath("staff") });

    test("prints an order's receipt, with only the receipt on paper", async ({ page }) => {
      const order = await placeAsGuest([{ productId: ESPRESSO, quantity: 2 }]);

      await page.goto(`/dashboard/orders/${order.id}`);
      await page.getByRole("link", { name: "Print receipt" }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/orders/${order.id}/receipt$`));

      const receipt = page.getByRole("article", { name: `Receipt for order #${order.orderNumber}` });
      await expect(receipt.getByText("Rira Book Cafe")).toBeVisible();
      await expect(receipt.getByText(/2× Espresso/)).toBeVisible();
      await expect(receipt.getByText(/^Including VAT/)).toBeVisible();
      await expect(receipt.getByText("Unpaid", { exact: true })).toBeVisible();

      // The button opens the browser's print dialog…
      await page.evaluate(() => {
        (window as unknown as { printed: boolean }).printed = false;
        window.print = () => {
          (window as unknown as { printed: boolean }).printed = true;
        };
      });
      await page.getByRole("button", { name: "Print", exact: true }).click();
      expect(await page.evaluate(() => (window as unknown as { printed: boolean }).printed)).toBe(true);

      // …and on paper the shell, the heading and the button drop away, leaving the receipt.
      await page.emulateMedia({ media: "print" });
      await expect(receipt).toBeVisible();
      await expect(page.getByRole("button", { name: "Print", exact: true })).toBeHidden();
      await expect(page.getByRole("heading", { name: `Receipt for order #${order.orderNumber}` })).toBeHidden();
      await expect(page.getByRole("navigation").first()).toBeHidden();
    });

    test("links a sale just rung up to its receipt", async ({ page }) => {
      await page.goto("/dashboard/orders/new");
      await page.getByRole("button", { name: "Add Espresso", exact: true }).click();
      await page.getByLabel("Guest's phone").fill(`0938${String(Date.now()).slice(-7)}`);
      await expect(page.getByRole("status").filter({ hasText: "New guest" })).toBeVisible();
      await page.getByLabel("Guest's name").fill("E2E Receipt Guest");
      await page.getByRole("button", { name: "Record sale" }).click();

      const done = page.getByRole("status").filter({ hasText: /^Sale #\d+ is in\./ });
      await expect(done).toBeVisible();
      await done.getByRole("link", { name: "Print receipt" }).click();
      await expect(page).toHaveURL(/\/dashboard\/orders\/[0-9a-f-]{36}\/receipt$/);
      await expect(page.getByRole("article", { name: /^Receipt for order #\d+$/ })).toBeVisible();
    });
  });

  test.describe("for the guest", () => {
    test.use({ storageState: storageStatePath("customer") });

    test("opens the receipt from their order, and nobody else can", async ({ page, browser }) => {
      const order = await placeAsGuest([{ productId: ESPRESSO, quantity: 1 }]);

      await page.goto(`/orders/${order.id}`);
      await page.getByRole("link", { name: "Receipt", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/orders/${order.id}/receipt$`));
      const receipt = page.getByRole("article", { name: `Receipt for order #${order.orderNumber}` });
      await expect(receipt.getByText(/1× Espresso/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Print", exact: true })).toBeVisible();

      const other = await browser.newContext({ storageState: storageStatePath("staff") });
      try {
        const page2 = await other.newPage();
        await page2.goto(`/orders/${order.id}/receipt`);
        await expect(page2.getByRole("article", { name: /^Receipt for order/ })).toHaveCount(0);
      } finally {
        await other.close();
      }
    });
  });
});

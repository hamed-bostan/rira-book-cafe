import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Service group's everyday clicks, end to end: moving an order through the bar
 * display and its own page, ticking lines served, taking and undoing a payment, an
 * internal note, a write-off, and the list's row menu and bulk bar. Each test rings
 * up its own orders at the counter (no guest rate limit) for a walk-in only it uses,
 * so the list can be searched down to them by phone.
 */

type Order = { id: string; orderNumber: number; status: string; paymentStatus: string; paymentMethod?: string };

/** A walk-in: a counter sale belongs to a guest profile, found by phone and named on the first sale. */
type Walkin = { name: string; phone: string };

const TAG = `E2E Svc ${Math.random().toString(36).replace(/\d/g, "").slice(0, 6)}`;
const ESPRESSO = "seed-espresso";
const CAPPUCCINO = "seed-cappuccino";

/** Each test's own walk-in. The phone is what the list is searched by. */
function walkin(n: number): Walkin {
  return { name: `${TAG} ${n}`, phone: `0912555018${n}` };
}

async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A sale rung up at the counter, unpaid and still to be made unless `complete`. Takeaway unless `dineIn`. */
async function ringUp(
  guest: Walkin,
  opts: { complete?: boolean; dineIn?: boolean; items?: { productId: string; quantity: number }[] } = {},
): Promise<Order> {
  const api = await adminApi();
  try {
    return await jsonOf<Order>(
      await api.post("/api/admin/orders", {
        data: {
          items: opts.items ?? [
            { productId: ESPRESSO, quantity: 1 },
            { productId: CAPPUCCINO, quantity: 1 },
          ],
          serviceType: opts.dineIn ? "dineIn" : "takeaway",
          ...(opts.dineIn ? { tableLabel: "3" } : {}),
          customerName: guest.name,
          customerPhone: guest.phone,
          ...(opts.complete ? { complete: true } : {}),
        },
      }),
    );
  } finally {
    await api.dispose();
  }
}

async function readOrder(id: string): Promise<Order> {
  const api = await adminApi();
  try {
    return await jsonOf<Order>(await api.get(`/api/admin/orders/${id}`));
  } finally {
    await api.dispose();
  }
}

/** A toast's title, exactly (its live region repeats it with a prefix). */
function toast(page: Page, text: string) {
  return page.getByText(text, { exact: true }).first();
}

test.describe("as floor staff", () => {
  test.use({ storageState: storageStatePath("staff") });

  test("the bar display starts an order, ticks a line and serves the rest", async ({ page }) => {
    const order = await ringUp(walkin(1));

    await page.goto("/dashboard/kitchen");
    const ticket = page.getByRole("article", { name: new RegExp(`^Order ${order.orderNumber},`) });
    await ticket.getByRole("button", { name: "Start making" }).click();
    await expect(toast(page, `#${order.orderNumber} moved to Being made`)).toBeVisible();

    const espresso = ticket.getByRole("checkbox", { name: /1×\s*Espresso/ });
    await espresso.click();
    await expect(espresso).toBeChecked();
    await expect(ticket.getByText("1 of 2 ready")).toBeVisible();

    await ticket.getByRole("button", { name: "Mark served" }).click();
    await expect(toast(page, `#${order.orderNumber} served`)).toBeVisible();
    await expect(ticket).toHaveCount(0);
    expect((await readOrder(order.id)).status).toBe("completed");
  });

  test("the order page moves it on, ticks a line, takes and undoes a payment, and keeps a note", async ({ page }) => {
    const order = await ringUp(walkin(2));

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Start preparing" }).click();
    await expect(toast(page, `Updated order #${order.orderNumber}: Preparing`)).toBeVisible();

    await page.getByRole("button", { name: "Mark Espresso served" }).click();
    await expect(page.getByText("1 of 2 served")).toBeVisible();
    await expect(page.getByRole("button", { name: "Take back the served mark on Espresso" })).toBeVisible();

    await page.getByRole("button", { name: "Mark served", exact: true }).click();
    await expect(toast(page, `Updated order #${order.orderNumber}: Served`)).toBeVisible();
    expect((await readOrder(order.id)).status).toBe("completed");

    await page.getByRole("button", { name: "Mark paid" }).click();
    await page.getByRole("button", { name: "Cash", exact: true }).click();
    await expect(page.getByText("Paid · Cash")).toBeVisible();
    expect(await readOrder(order.id)).toMatchObject({ paymentStatus: "paid", paymentMethod: "cash" });

    await page.getByRole("button", { name: "Unmark" }).click();
    await expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible();
    expect((await readOrder(order.id)).paymentStatus).toBe("unpaid");

    const note = `${TAG} left a scarf at the counter`;
    await page.getByLabel("Internal note").fill(note);
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
  });

  test("the list's row menu moves an order on, marks one paid and cancels another", async ({ page }) => {
    const guest = walkin(3);
    const first = await ringUp(guest);
    const second = await ringUp(guest);

    await page.goto(`/dashboard/orders?q=${guest.phone}`);
    await page.getByRole("button", { name: `Actions for order #${first.orderNumber}` }).click();
    await page.getByRole("menuitem", { name: "Start preparing" }).click();
    await expect(toast(page, `Order #${first.orderNumber} moved to preparing`)).toBeVisible();

    await page.getByRole("button", { name: `Actions for order #${first.orderNumber}` }).click();
    await page.getByRole("menuitem", { name: "Mark as paid" }).click();
    await page.getByRole("menuitem", { name: "Card (POS)" }).click();
    await expect(toast(page, `Order #${first.orderNumber} marked as paid`)).toBeVisible();
    expect(await readOrder(first.id)).toMatchObject({
      status: "preparing",
      paymentStatus: "paid",
      paymentMethod: "card",
    });

    await page.getByRole("button", { name: `Actions for order #${second.orderNumber}` }).click();
    await page.getByRole("menuitem", { name: "Cancel order" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel order" }).click();
    await expect(toast(page, `Order #${second.orderNumber} cancelled`)).toBeVisible();
    expect((await readOrder(second.id)).status).toBe("cancelled");
  });

  test("the bulk bar serves, marks paid and cancels only the ticked orders that fit", async ({ page }) => {
    const guest = walkin(4);
    const making = await ringUp(guest);
    const waiting = await ringUp(guest);
    const leaving = await ringUp(guest);
    const api = await adminApi();
    await jsonOf(await api.patch(`/api/admin/orders/${making.id}/status`, { data: { status: "preparing" } }));
    await api.dispose();

    await page.goto(`/dashboard/orders?q=${guest.phone}`);
    await page.getByRole("checkbox", { name: `Select order #${making.orderNumber}` }).click();
    await page.getByRole("checkbox", { name: `Select order #${waiting.orderNumber}` }).click();
    // Only the one being made can be handed over: the button says so, and the toast names it.
    await page.getByRole("button", { name: "Mark served (1)" }).click();
    await expect(toast(page, `Order #${making.orderNumber} marked as served`)).toBeVisible();
    expect((await readOrder(making.id)).status).toBe("completed");
    expect((await readOrder(waiting.id)).status).toBe("pending");

    // Both are unpaid, so marking paid fits the whole selection.
    await page.getByRole("checkbox", { name: `Select order #${making.orderNumber}` }).click();
    await page.getByRole("checkbox", { name: `Select order #${waiting.orderNumber}` }).click();
    await page.getByRole("button", { name: "Mark paid", exact: true }).click();
    await page.getByRole("menuitem", { name: "Card-to-card" }).click();
    await expect(toast(page, "2 orders marked as paid")).toBeVisible();
    for (const order of [making, waiting]) {
      expect(await readOrder(order.id)).toMatchObject({ paymentStatus: "paid", paymentMethod: "transfer" });
    }

    await page.getByRole("checkbox", { name: `Select order #${leaving.orderNumber}` }).click();
    await page.getByRole("button", { name: "Cancel orders", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel orders" }).click();
    await expect(toast(page, `Order #${leaving.orderNumber} cancelled`)).toBeVisible();
    expect((await readOrder(leaving.id)).status).toBe("cancelled");
  });

  test("the list filters by service and sorts by total", async ({ page }) => {
    const guest = walkin(5);
    const small = await ringUp(guest);
    const big = await ringUp(guest, { dineIn: true, items: [{ productId: CAPPUCCINO, quantity: 4 }] });

    await page.goto(`/dashboard/orders?q=${guest.phone}&service=dineIn`);
    await expect(page.getByRole("link", { name: `View order #${big.orderNumber}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `View order #${small.orderNumber}` })).toHaveCount(0);

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(page.getByRole("link", { name: `View order #${small.orderNumber}` })).toBeVisible();

    const rows = page.getByRole("link", { name: /^View order #/ });
    await page.goto(`/dashboard/orders?q=${guest.phone}&sort=total&dir=desc`);
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAccessibleName(`View order #${big.orderNumber}`);
    await page.goto(`/dashboard/orders?q=${guest.phone}&sort=total&dir=asc`);
    await expect(rows.first()).toHaveAccessibleName(`View order #${small.orderNumber}`);
  });
});

test.describe("for the books", () => {
  test.use({ storageState: storageStatePath("admin") });

  test("writes off a served order the guest never paid for", async ({ page }) => {
    const order = await ringUp(walkin(6), { complete: true });

    await page.goto(`/dashboard/orders/${order.id}`);
    await page.getByRole("button", { name: "Write off" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason (optional)").fill("Left without paying");
    await dialog.getByRole("button", { name: "Write off" }).click();
    await expect(toast(page, `Order #${order.orderNumber} written off`)).toBeVisible();
    expect((await readOrder(order.id)).status).toBe("cancelled");
    await expect(page.getByRole("button", { name: "Write off" })).toHaveCount(0);
  });
});

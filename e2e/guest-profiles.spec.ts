import { expect, request, test, type Browser, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Staff acting for a guest the cafe hasn't met: a booking and a sale, found by the
 * guest's phone — the first makes their profile, the second finds it — and the
 * guest, signing in with that number for the first time, finds both and the
 * messages about them waiting in their profile.
 */

test.use({ storageState: storageStatePath("staff") });

/** A phone nobody has signed in with: `0937` and seven digits from the clock and a dice roll. */
function freshPhone(): string {
  const digits = `${Date.now() % 1_000_000}${Math.floor(Math.random() * 10)}`.padStart(7, "0");
  return `0937${digits.slice(-7)}`;
}

/** The guest's first sign-in with the mock code, in a browser of its own. */
async function signInAsGuest(browser: Browser, phone: string): Promise<Page> {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL }]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Phone number" }).fill(phone);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/login\/verify/);
  await page.getByRole("button", { name: /Dev code:/ }).click();
  await page.getByRole("button", { name: "Verify Code" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
}

test("staff book and sell for a new guest by phone, and the guest finds it all when they sign in", async ({
  page,
  browser,
}) => {
  const phone = freshPhone();
  const name = "E2E Golnaz Ahmadi";
  // A day nothing else books, so the table is free.
  const day = shiftCafeDay(cafeDayOf(new Date()), 11);

  // New booking: the number has no profile, so the guest's name is asked for.
  await page.goto(`/dashboard/reservations?day=${day}`);
  await page.getByRole("button", { name: "New booking" }).click();
  const dialog = page.getByRole("dialog");
  const save = dialog.getByRole("button", { name: "Save as request" });
  await expect(async () => {
    await dialog.getByLabel("Guest's phone").fill(`${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`);
    await expect(dialog.getByRole("status").filter({ hasText: "New guest" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await expect(save).toBeDisabled();
  await dialog.getByLabel("Guest's name").fill(name);
  await save.click();
  const booked = page.getByText(new RegExp(`^R-\\d+ booked for ${name}`)).first();
  await expect(booked).toBeVisible();
  const reference = Number((await booked.textContent())?.match(/R-(\d+)/)?.[1]);

  // New sale: the same number, typed another way, finds them — no name asked for.
  await page.goto("/dashboard/orders/new");
  await page.getByRole("button", { name: "Add Espresso", exact: true }).click();
  await page.getByLabel("Guest's phone").fill(`+98 ${phone.slice(1)}`);
  await expect(
    page.getByRole("status").filter({ hasText: `${name} · has a profile · hasn't signed in yet` }),
  ).toBeVisible();
  await expect(page.getByLabel("Guest's name")).toHaveCount(0);
  // Left in the bar's queue, so the guest hears how it goes.
  await page.getByRole("switch", { name: "Hand over now" }).click();
  await page.getByRole("button", { name: "Record sale" }).click();
  const sold = page.getByText(/Sale recorded as order #\d+/).first();
  await expect(sold).toBeVisible();
  const number = Number((await sold.textContent())?.match(/#(\d+)/)?.[1]);

  // Staff confirm the booking and start on the order: both are news to the guest.
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const bookings = await jsonOf<{ id: string; reference: number }[]>(
    await api.get(`/api/admin/reservations?day=${day}`),
  );
  const booking = bookings.find((one) => one.reference === reference);
  if (!booking) throw new Error(`R-${reference} isn't on ${day}`);
  await jsonOf(
    await api.patch(`/api/admin/reservations/${booking.id}`, { data: { status: "confirmed", tableLabel: "3" } }),
  );
  const { items } = await jsonOf<{ items: { id: string; orderNumber: number }[] }>(
    await api.get(`/api/admin/orders?q=${number}`),
  );
  const order = items.find((one) => one.orderNumber === number);
  if (!order) throw new Error(`order #${number} isn't listed`);
  await jsonOf(await api.patch(`/api/admin/orders/${order.id}/status`, { data: { status: "preparing" } }));
  await api.dispose();

  // The guest signs in with that number for the first time, and it's all there.
  const guest = await signInAsGuest(browser, phone);
  await guest.goto("/reservations");
  await expect(guest.getByText(`R-${reference}`, { exact: false }).first()).toBeVisible();
  await guest.goto("/orders");
  await expect(guest.getByText(`#${number}`, { exact: false }).first()).toBeVisible();
  await guest.goto("/messages");
  await expect(guest.getByRole("listitem").filter({ hasText: "Your table is confirmed" })).toContainText(
    `R-${reference}`,
  );
  await expect(guest.getByRole("listitem").filter({ hasText: `Order #${number} is being prepared` })).toBeVisible();
  await guest.context().close();

  // Staff looking the number up now see they've signed in.
  await page.goto("/dashboard/orders/new");
  await expect(async () => {
    await page.getByLabel("Guest's phone").fill(phone);
    await expect(page.getByRole("status").filter({ hasText: "has a profile" })).toHaveText(`${name} · has a profile`, {
      timeout: 2000,
    });
  }).toPass();
});

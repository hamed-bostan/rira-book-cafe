import { expect, request, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay, wallTimeToDate } from "../src/domain/entities/CafeTime";
import { formatOrderDate, formatOrderTime } from "../src/lib/formatOrderDate";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Changing bookings after they're made: a guest books a table late at night, staff
 * move a guest's booking to another day (and the guest's own list follows), extend
 * a stay the guest is already in, and call off an event with guests signed up —
 * who each find it in their notifications.
 *
 * Seeds are idempotent: each test clears what an earlier run of it left behind
 * (by a marker in the note or the name) before adding its own.
 */

test.use({ storageState: storageStatePath("admin") });

const today = cafeDayOf(new Date());
const RESCHEDULE_NOTE = "E2E reschedule me";
const STAY_GUEST = "E2E Extended Stay Guest";

type Reservation = { id: string; reference: number; startsAt: string; status: string; note?: string };
type Stay = { id: string; reference: number; guestName: string; status: string; checkOut: string };

async function api(user: "admin" | "customer"): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath(user) });
}

/** A page signed in as `user`, in English. */
async function pageAs(browser: Browser, user: "admin" | "customer"): Promise<Page> {
  const context = await browser.newContext({ storageState: storageStatePath(user) });
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: E2E_BASE_URL }]);
  return context.newPage();
}

test("a guest books a table for 23:30 and sees it in their bookings", async ({ browser }) => {
  const day = shiftCafeDay(today, 10);
  const startsAt = wallTimeToDate(`${day}T23:30`).toISOString();
  const page = await pageAs(browser, "customer");

  await page.goto("/book");
  await page.getByLabel("Day", { exact: true }).fill(day);
  await page.getByRole("combobox", { name: "Time", exact: true }).selectOption("23:30");
  await page.getByRole("button", { name: "Request a table" }).click();

  await expect(page).toHaveURL(/\/reservations$/);
  await expect(
    page.getByText(`${formatOrderDate(startsAt, "en")} · ${formatOrderTime(startsAt, "en")}`).first(),
  ).toBeVisible();
  await page.context().close();
});

test("staff move a guest's booking to another day, and the guest's list shows the new day", async ({
  page,
  browser,
}) => {
  const from = shiftCafeDay(today, 12);
  const to = shiftCafeDay(today, 14);
  const admin = await api("admin");
  const guest = await api("customer");

  // Clear what an earlier run left, then a guest's request, confirmed at a table.
  const earlier = await jsonOf<Reservation[]>(await admin.get(`/api/admin/reservations?from=${today}`));
  for (const old of earlier.filter((one) => one.note === RESCHEDULE_NOTE && one.status !== "cancelled")) {
    await jsonOf(await admin.patch(`/api/admin/reservations/${old.id}`, { data: { status: "cancelled" } }));
  }
  const asked = await jsonOf<Reservation>(
    await guest.post("/api/reservations", { data: { startsAt: `${from}T19:00`, partySize: 2, note: RESCHEDULE_NOTE } }),
  );
  await jsonOf(
    await admin.patch(`/api/admin/reservations/${asked.id}`, { data: { status: "confirmed", tableLabel: "2" } }),
  );

  await page.goto(`/dashboard/reservations?day=${from}`);
  await page.getByRole("button", { name: `More actions for R-${asked.reference}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit booking" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Day", { exact: true }).fill(to);
  await dialog.getByRole("combobox", { name: "Time", exact: true }).selectOption("20:00");
  // The floor of the new day loads, with the booking's table free then.
  await expect(dialog.getByRole("radio", { name: /^Table 2/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText(new RegExp(`R-${asked.reference} saved`)).first()).toBeVisible();
  // It has left the day it was on.
  await expect(page.getByRole("article", { name: new RegExp(`^R-${asked.reference},`) })).toHaveCount(0);

  const movedTo = wallTimeToDate(`${to}T20:00`).toISOString();
  const guestPage = await pageAs(browser, "customer");
  await guestPage.goto("/reservations");
  await expect(
    guestPage.getByText(`${formatOrderDate(movedTo, "en")} · ${formatOrderTime(movedTo, "en")}`).first(),
  ).toBeVisible();
  await expect(guestPage.getByText(`R-${asked.reference}`, { exact: false }).first()).toBeVisible();
  await guestPage.context().close();

  await admin.dispose();
  await guest.dispose();
});

test("staff extend a stay the guest is already in", async ({ page }) => {
  const admin = await api("admin");
  // An earlier run's stay is checked out, so the suite is free again.
  const earlier = await jsonOf<Stay[]>(await admin.get(`/api/admin/suite-bookings?from=${shiftCafeDay(today, -30)}`));
  for (const old of earlier.filter((one) => one.guestName === STAY_GUEST)) {
    if (old.status === "checkedIn") {
      await jsonOf(await admin.patch(`/api/admin/suite-bookings/${old.id}`, { data: { status: "checkedOut" } }));
    } else if (old.status === "confirmed" || old.status === "requested") {
      await jsonOf(await admin.patch(`/api/admin/suite-bookings/${old.id}`, { data: { status: "cancelled" } }));
    }
  }

  const stay = await jsonOf<Stay>(
    await admin.post("/api/admin/suite-bookings", {
      data: {
        guestName: STAY_GUEST,
        guestPhone: "0912 555 0101",
        checkIn: today,
        checkOut: shiftCafeDay(today, 1),
        guests: 2,
        note: "",
      },
    }),
  );
  await jsonOf(await admin.patch(`/api/admin/suite-bookings/${stay.id}`, { data: { status: "checkedIn" } }));

  try {
    await page.goto("/dashboard/suite");
    await page.getByRole("button", { name: `More actions for S-${stay.reference}`, exact: true }).click();
    await page.getByRole("menuitem", { name: "Edit stay" }).click();
    const dialog = page.getByRole("dialog");
    // Once the guest is in, only the departure can change.
    await expect(dialog.getByLabel("Check-in", { exact: true })).toBeDisabled();
    await dialog.getByLabel("Check-out", { exact: true }).fill(shiftCafeDay(today, 3));
    await expect(dialog.getByText(/^3 nights · /)).toBeVisible();
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText(new RegExp(`S-${stay.reference} saved`)).first()).toBeVisible();
    const row = page.getByRole("article", { name: new RegExp(`^S-${stay.reference},`) });
    await expect(row.getByText(new RegExp(`3 nights · S-${stay.reference}`))).toBeVisible();
  } finally {
    // Leave the suite free for the specs that book it next.
    await admin.patch(`/api/admin/suite-bookings/${stay.id}`, { data: { status: "checkedOut" } });
    await admin.dispose();
  }
});

test("staff call off an event, and the guest signed up finds it in their notifications", async ({ page, browser }) => {
  const title = `E2E Rooftop poetry night ${Date.now()}`;
  const day = shiftCafeDay(today, 9);
  const admin = await api("admin");
  const guest = await api("customer");
  const event = await jsonOf<{ id: string }>(
    await admin.post("/api/events", {
      data: {
        kind: "reading",
        title,
        description: "",
        titleFa: "",
        descriptionFa: "",
        imageUrl: "",
        startsAt: `${day}T18:00`,
        endsAt: `${day}T20:00`,
        capacity: "",
        price: "0",
        isPublished: true,
      },
    }),
  );
  await jsonOf(await guest.post(`/api/events/${event.id}/registrations`, { data: { seats: 2 } }));

  await page.goto(`/dashboard/events/${event.id}/edit`);
  await page.getByRole("button", { name: "Cancel event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/the 1 guest signed up is told/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel event", exact: true }).click();

  await expect(page.getByText(`“${title}” is cancelled`).first()).toBeVisible();
  // The sign-up is cancelled, and there's nothing left to call off.
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel event", exact: true })).toHaveCount(0);

  const guestPage = await pageAs(browser, "customer");
  await guestPage.goto("/notifications");
  await expect(guestPage.getByText(`${title} is off`).first()).toBeVisible();
  await guestPage.context().close();

  await admin.dispose();
  await guest.dispose();
});

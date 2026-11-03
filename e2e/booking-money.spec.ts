import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Money on bookings, as the desk handles it: a deposit taken on a table and handed
 * back once the party has left; a suite stay paid with its balance filled in, then
 * part of it refunded and the rest refunded as it's cancelled; and a cancelled
 * event sign-up's tickets handed back. Each step books its entry; the guest hears
 * about a refund in their inbox.
 */

test.use({ storageState: storageStatePath("admin") });

const today = cafeDayOf(new Date());

let api: APIRequestContext;
let guest: APIRequestContext;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
});

test.afterAll(async () => {
  await api.dispose();
  await guest.dispose();
});

test("staff take a deposit on a table and hand it back once the party has left", async ({ page }) => {
  const day = shiftCafeDay(today, 2);
  const booking = await jsonOf<{ id: string; reference: number }>(
    await api.post("/api/admin/reservations", {
      data: {
        startsAt: `${day}T12:30`,
        partySize: 8,
        guestName: `E2E Deposit ${Date.now()}`,
        guestPhone: "0912 345 1111",
        note: "",
        tableLabel: "3",
      },
    }),
  );

  await page.goto(`/dashboard/reservations?day=${day}`);
  const row = page.getByRole("article", { name: new RegExp(`^R-${booking.reference}, `) });
  await row.getByRole("button", { name: "Take deposit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount (Toman)").fill("500000");
  await dialog.getByLabel("Paid by").selectOption("card");
  await expect(dialog.getByText("500,000 Toman held on Deposits held — not income.")).toBeVisible();
  await dialog.getByRole("button", { name: "Take deposit" }).click();
  await expect(row.getByText("Deposit held: 500,000 Toman")).toBeVisible();
  // It's held while the booking is on: no way to settle it yet.
  await expect(row.getByRole("button", { name: "Return deposit" })).toHaveCount(0);

  // The party sits down and leaves.
  for (const status of ["seated", "completed"]) {
    await jsonOf(await api.patch(`/api/admin/reservations/${booking.id}`, { data: { status } }));
  }
  await page.reload();

  await row.getByRole("button", { name: "Return deposit" }).click();
  await expect(page.getByRole("dialog").getByText(/500,000 Toman goes back to .* \(Card\)\./)).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Return deposit" }).click();
  await expect(row.getByText("Deposit returned: 500,000 Toman")).toBeVisible();
  await expect(row.getByRole("button", { name: /deposit/i })).toHaveCount(0);

  // Held, then handed back: two entries in the books, netting Deposits held to nothing for it.
  const journal = await jsonOf<{ items: { sourceId?: string; lines: { accountCode: string; debit: number }[] }[] }>(
    await api.get("/api/admin/accounting/journal?source=reservationDeposit&pageSize=100"),
  );
  const entries = journal.items.filter((entry) => entry.sourceId === booking.id);
  expect(entries).toHaveLength(2);
  expect(
    entries.flatMap((entry) => entry.lines.filter((line) => line.debit > 0).map((line) => line.accountCode)).sort(),
  ).toEqual(["1120", "2400"]);
});

test("a suite stay is paid with its balance filled in, then refunded in part and on cancelling", async ({ page }) => {
  const checkIn = shiftCafeDay(today, 30 + (Date.now() % 60));
  const stay = await jsonOf<{ id: string; reference: number }>(
    await api.post("/api/admin/suite-bookings", {
      data: {
        checkIn,
        checkOut: shiftCafeDay(checkIn, 2),
        guests: 2,
        guestName: "Test Guest",
        guestPhone: "09120000004",
      },
    }),
  );

  await page.goto(`/dashboard/suite?focus=${stay.id}`);
  const row = page.getByRole("article", { name: `S-${stay.reference}, Test Guest` });
  // Two nights at the suite's price.
  await expect(row.getByText("Total 5,000,000 Toman")).toBeVisible();
  await expect(row.getByText("2,500,000 Toman a night")).toBeVisible();
  await expect(row.getByText("Due 5,000,000 Toman")).toBeVisible();

  await row.getByRole("button", { name: "Take payment" }).click();
  const payment = page.getByRole("dialog");
  await expect(payment.getByLabel("Total (VAT included)")).toHaveValue("5000000");
  await payment.getByRole("button", { name: "Record income" }).click();
  await expect(row.getByText("Paid in full")).toBeVisible();

  await row.getByRole("button", { name: "Refund Test Guest" }).click();
  const refund = page.getByRole("dialog");
  await expect(refund.getByText("Paid 5,000,000 Toman. Up to 5,000,000 Toman can go back.")).toBeVisible();
  await refund.getByLabel("Amount (VAT included)").fill("1000000");
  await refund.getByLabel("Paid back by").selectOption("transfer");
  await refund.getByLabel("Reason (optional)").fill("Late check-in");
  await refund.getByRole("button", { name: "Refund", exact: true }).click();
  await expect(row.getByText("Refunded 1,000,000 Toman")).toBeVisible();
  await expect(row.getByText("Due 1,000,000 Toman")).toBeVisible();

  // The guest hears about it, by the phone the stay was booked under.
  const notices = await jsonOf<{ kind: string; params: Record<string, unknown> }[]>(
    await guest.get("/api/notifications"),
  );
  expect(notices.find((notice) => notice.kind === "refundIssued")?.params).toMatchObject({
    amount: 1000000,
    subject: "suite",
    reference: stay.reference,
  });

  // Cancelling offers to hand back the rest in the same click.
  await row.getByRole("button", { name: `More actions for S-${stay.reference}` }).click();
  await page.getByRole("menuitem", { name: "Cancel booking" }).click();
  const cancel = page.getByRole("dialog");
  await cancel.getByRole("checkbox", { name: /Refund the guest now/ }).click();
  await expect(cancel.getByLabel("Amount (VAT included)")).toHaveValue("4000000");
  await cancel.getByRole("button", { name: "Cancel booking" }).click();
  await expect(page.getByText("Refunded 4,000,000 Toman to Test Guest").first()).toBeVisible();

  const stays = await jsonOf<{ id: string; status: string; refundedAmount?: number }[]>(
    await api.get(`/api/admin/suite-bookings?from=${today}`),
  );
  expect(stays.find((row) => row.id === stay.id)).toMatchObject({ status: "cancelled", refundedAmount: 5000000 });
});

test("a cancelled event sign-up's tickets are refunded, and the button goes once they are", async ({ page }) => {
  const event = await jsonOf<{ id: string }>(
    await api.post("/api/events", {
      data: {
        kind: "reading",
        title: `E2E Refunded reading ${Date.now()}`,
        description: "",
        titleFa: "",
        descriptionFa: "",
        imageUrl: "",
        startsAt: `${shiftCafeDay(today, 4)}T17:00`,
        endsAt: `${shiftCafeDay(today, 4)}T19:00`,
        capacity: "20",
        price: "150000",
        isPublished: true,
      },
    }),
  );
  const signUp = await jsonOf<{ id: string }>(
    await guest.post(`/api/events/${event.id}/registrations`, { data: { seats: 2 } }),
  );
  await jsonOf(
    await api.post("/api/admin/income", {
      data: {
        date: today,
        accountCode: "4400",
        description: "E2E two tickets",
        amount: "300000",
        vatAmount: "",
        method: "card",
        payerName: "Test Guest",
        sourceType: "eventRegistration",
        sourceId: signUp.id,
      },
    }),
  );
  await jsonOf(await api.delete(`/api/admin/events/${event.id}/registrations/${signUp.id}`));

  await page.goto(`/dashboard/events/${event.id}/edit`);
  // The guest list's row, by the phone it shows (the activity log names the guest too).
  const row = page.getByRole("listitem").filter({ hasText: "09120000004" });
  await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Refund Test Guest" }).click();
  const dialog = page.getByRole("dialog");
  // A cancelled sign-up is owed all of it back.
  await expect(dialog.getByLabel("Amount (VAT included)")).toHaveValue("300000");
  await dialog.getByRole("button", { name: "Refund", exact: true }).click();

  await expect(row.getByText("Refunded 300,000 Toman")).toBeVisible();
  await expect(row.getByRole("button", { name: "Refund Test Guest" })).toHaveCount(0);
});

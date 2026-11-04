import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Bookings and Library clicks nothing else makes: a table booking seated (and
 * the seat undone), completed and moved; a stay checked in, undone, and checked
 * out; a loan extended and the extension undone; a guest messaged about a stay and
 * a loan; an event made, edited, given tables and deleted from its form; and a past
 * event's page opened from the Past tab.
 */

test.use({ storageState: storageStatePath("admin") });

const today = cafeDayOf(new Date());
const TAG = `E2E Bk ${Math.random().toString(36).replace(/\d/g, "").slice(0, 6)}`;
const BLIND_OWL = "seed-book-blind-owl";

type Reservation = { id: string; reference: number; status: string; tableLabel?: string };
type Stay = { id: string; reference: number; guestName: string; status: string };
type Loan = { id: string; reference: number; dueAt: string };
type Event = { id: string; title: string };

async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A toast's title, exactly (its live region repeats it with a prefix). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, typeof text === "string" ? { exact: true } : undefined).first();
}

/** The toast's Undo: the newest toast's, since an earlier one may still be fading. */
function undo(page: Page) {
  return page.getByRole("button", { name: "Undo", exact: true }).last();
}

test("a table booking is seated, the seat undone, then completed; another moves table", async ({ page }) => {
  const day = shiftCafeDay(today, 4);
  const api = await adminApi();
  const book = async (at: string): Promise<Reservation> => {
    const made = await jsonOf<Reservation>(
      await api.post("/api/admin/reservations", {
        data: {
          guestName: `${TAG} Table`,
          guestPhone: "0912 555 0191",
          startsAt: `${day}T${at}`,
          partySize: 2,
          note: "",
        },
      }),
    );
    return jsonOf<Reservation>(
      await api.patch(`/api/admin/reservations/${made.id}`, { data: { status: "confirmed", tableLabel: "3" } }),
    );
  };
  const seated = await book("12:00");
  const moving = await book("15:00");
  const statusOf = async (id: string): Promise<Reservation> => {
    const day_ = await jsonOf<Reservation[]>(await api.get(`/api/admin/reservations?from=${day}`));
    const found = day_.find((one) => one.id === id);
    if (!found) throw new Error(`booking ${id} isn't listed`);
    return found;
  };

  await page.goto(`/dashboard/reservations?day=${day}`);
  const row = page.getByRole("article", { name: new RegExp(`^R-${seated.reference}, `) });
  await row.getByRole("button", { name: "Seat", exact: true }).click();
  await expect(toast(page, `Updated R-${seated.reference}: Seated`)).toBeVisible();
  await undo(page).click();
  await expect(toast(page, `R-${seated.reference} is back to Confirmed`)).toBeVisible();
  expect((await statusOf(seated.id)).status).toBe("confirmed");

  await row.getByRole("button", { name: "Seat", exact: true }).click();
  await expect(toast(page, `Updated R-${seated.reference}: Seated`)).toBeVisible();
  await row.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(toast(page, `Updated R-${seated.reference}: Completed`)).toBeVisible();
  expect((await statusOf(seated.id)).status).toBe("completed");

  await page.getByRole("button", { name: `More actions for R-${moving.reference}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Change table" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /^Table 5/ }).click();
  await dialog.getByRole("button", { name: "Save table" }).click();
  await expect(toast(page, new RegExp(`^R-${moving.reference} moved to`))).toBeVisible();
  expect(await statusOf(moving.id)).toMatchObject({ status: "confirmed", tableLabel: "5" });
  await api.dispose();
});

test("a stay is checked in, the check-in undone, then checked in and out; its guest gets a message", async ({
  page,
}) => {
  const api = await adminApi();
  // The one suite: an earlier stay over today (this spec's, another's) makes way.
  const earlier = await jsonOf<Stay[]>(await api.get(`/api/admin/suite-bookings?from=${shiftCafeDay(today, -30)}`));
  for (const old of earlier) {
    if (old.status === "checkedIn") {
      await jsonOf(await api.patch(`/api/admin/suite-bookings/${old.id}`, { data: { status: "checkedOut" } }));
    } else if (old.status === "confirmed" || old.status === "requested") {
      await jsonOf(await api.patch(`/api/admin/suite-bookings/${old.id}`, { data: { status: "cancelled" } }));
    }
  }
  const name = `${TAG} Stay`;
  const stay = await jsonOf<Stay>(
    await api.post("/api/admin/suite-bookings", {
      data: {
        guestName: name,
        guestPhone: "0912 555 0192",
        checkIn: today,
        checkOut: shiftCafeDay(today, 1),
        guests: 2,
        note: "",
      },
    }),
  );

  await page.goto(`/dashboard/suite?focus=${stay.id}`);
  const row = page.getByRole("article", { name: new RegExp(`^S-${stay.reference}, `) });
  await row.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(toast(page, `Updated S-${stay.reference}: Checked in`)).toBeVisible();
  await undo(page).click();
  await expect(toast(page, `S-${stay.reference} is back to Confirmed`)).toBeVisible();

  await row.getByRole("button", { name: "Message", exact: false }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("The suite is ready from 2pm.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(toast(page, new RegExp(`^Message sent to `))).toBeVisible();

  await row.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(toast(page, `Updated S-${stay.reference}: Checked in`)).toBeVisible();
  await row.getByRole("button", { name: "Check out", exact: true }).click();
  await expect(toast(page, `Updated S-${stay.reference}: Checked out`)).toBeVisible();
  const after = await jsonOf<Stay[]>(await api.get(`/api/admin/suite-bookings?from=${shiftCafeDay(today, -1)}`));
  expect(after.find((one) => one.id === stay.id)?.status).toBe("checkedOut");
  await api.dispose();
});

test("a loan is extended a week, the extension undone, and its borrower messaged", async ({ page }) => {
  const api = await adminApi();
  const phone = "09125550193";
  const loan = await jsonOf<Loan>(
    await api.post("/api/admin/book-loans", {
      data: {
        productId: BLIND_OWL,
        borrowerName: `${TAG} Reader`,
        borrowerPhone: phone,
        dueOn: shiftCafeDay(today, 14),
        note: "",
      },
    }),
  );
  const dueOf = async (): Promise<string> => {
    const { items } = await jsonOf<{ items: Loan[] }>(await api.get(`/api/admin/book-loans?q=${phone}`));
    const found = items.find((one) => one.id === loan.id);
    if (!found) throw new Error(`L-${loan.reference} isn't listed`);
    return found.dueAt;
  };

  await page.goto(`/dashboard/book-loans?q=${phone}`);
  const row = page.getByRole("article", { name: new RegExp(`^L-${loan.reference}, `) });
  await row.getByRole("button", { name: `More actions for L-${loan.reference}` }).click();
  await page.getByRole("menuitem", { name: "Extend 7 days" }).click();
  await expect(toast(page, new RegExp(`^L-${loan.reference} now due `))).toBeVisible();
  expect(new Date(await dueOf()).getTime() - new Date(loan.dueAt).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  await undo(page).click();
  await expect(toast(page, new RegExp(`^L-${loan.reference} is due .* again$`))).toBeVisible();
  expect(await dueOf()).toBe(loan.dueAt);

  await row.getByRole("button", { name: "Message", exact: false }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Keep it another week if you like.");
  await dialog.getByRole("button", { name: "Send" }).click();
  await expect(toast(page, new RegExp(`^Message sent to `))).toBeVisible();

  // Back on the shelf for the next spec that lends it.
  await jsonOf(await api.patch(`/api/admin/book-loans/${loan.id}`, { data: { status: "returned" } }));
  await api.dispose();
});

test("an event is made from its form, edited, given a table, and deleted", async ({ page }) => {
  const day = shiftCafeDay(today, 20);
  const title = `${TAG} Zine workshop`;

  await page.goto("/dashboard/events/create");
  await page.getByRole("button", { name: "Workshop", exact: true }).click();
  const english = page.getByRole("group", { name: "English" });
  await expect(async () => {
    await english.getByLabel("Title").fill(title);
    await expect(english.getByLabel("Title")).toHaveValue(title);
  }).toPass();
  await page.getByLabel("Starts").fill(`${day}T17:00`);
  await page.getByLabel("Ends").fill(`${day}T19:00`);
  await page.getByLabel("Seats").fill("8");
  await page.getByRole("button", { name: "Create event" }).click();
  await expect(toast(page, "Event created")).toBeVisible();

  const api = await adminApi();
  const created = (await jsonOf<Event[]>(await api.get("/api/admin/events"))).find((one) => one.title === title);
  expect(created).toBeDefined();
  const id = created?.id ?? "";

  await page.goto(`/dashboard/events/${id}/edit`);
  const renamed = `${title} (zines)`;
  const titleField = page.getByRole("group", { name: "English" }).getByLabel("Title");
  // Fills before hydration are reset; retry until the form holds the new title.
  await expect(async () => {
    await titleField.fill(renamed);
    await page.waitForTimeout(300);
    await expect(titleField).toHaveValue(renamed, { timeout: 500 });
  }).toPass();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(toast(page, "Event saved")).toBeVisible();
  expect((await jsonOf<Event>(await api.get(`/api/admin/events/${id}`))).title).toBe(renamed);

  await page.goto("/dashboard/events");
  const card = page.getByRole("article").filter({ hasText: renamed });
  await card.getByRole("button", { name: "Hold tables" }).click();
  const tables = page.getByRole("dialog");
  await tables.getByRole("checkbox", { name: /^Table 4/ }).click();
  await tables.getByRole("button", { name: "Save tables" }).click();
  await expect(toast(page, `Tables saved for ${renamed}`)).toBeVisible();
  await expect(card.getByText("Tables held")).toBeVisible();

  await page.goto(`/dashboard/events/${id}/edit`);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(toast(page, `"${renamed}" deleted`)).toBeVisible();
  expect((await api.get(`/api/admin/events/${id}`)).status()).toBe(404);
  await api.dispose();
});

test("a past event's page opens from the Past tab, where its guest list lives", async ({ page }) => {
  const api = await adminApi();
  const day = shiftCafeDay(today, -3);
  const title = `${TAG} Last week's reading`;
  await jsonOf<Event>(
    await api.post("/api/events", {
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
        isPublished: false,
      },
    }),
  );
  await api.dispose();

  await page.goto("/dashboard/events?tab=past");
  await page.getByRole("link", { name: `Edit ${title}` }).click();
  await expect(page.getByRole("heading", { name: "Edit event" })).toBeVisible();
  // Over, so it can't be called off any more — but it opens.
  await expect(page.getByRole("button", { name: "Cancel event" })).toHaveCount(0);
});

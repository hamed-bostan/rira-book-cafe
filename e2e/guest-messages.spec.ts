import { expect, request, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * Messages reach every guest, with or without an account: staff write to a guest
 * who booked by phone, and a guest who joined a book's line at the counter is told
 * it's back — and each finds it in Messages the first time they sign in with that
 * phone. Each run uses phones nobody has used, so it can run again on the same
 * database.
 */

test.use({ storageState: storageStatePath("staff") });

/** A phone nobody has signed in with: `0939` and seven digits from the clock and a dice roll. */
function freshPhone(): string {
  const digits = `${Date.now() % 1_000_000}${Math.floor(Math.random() * 10)}`.padStart(7, "0");
  return `0939${digits.slice(-7)}`;
}

/** As typed at the counter: grouped, so the match by phone has to normalize it. */
const typed = (phone: string): string => `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;

async function staffApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
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

test("staff message a guest who booked by phone, and the guest reads it in Messages", async ({ page, browser }) => {
  const phone = freshPhone();
  const tomorrow = shiftCafeDay(cafeDayOf(new Date()), 1);
  const api = await staffApi();
  const booking = await jsonOf<{ reference: number }>(
    await api.post("/api/admin/reservations", {
      data: {
        startsAt: `${tomorrow}T19:30`,
        partySize: 3,
        guestName: "E2E Parisa",
        guestPhone: typed(phone),
        note: "",
      },
    }),
  );
  await api.dispose();
  const text = "We've kept the table by the window for you.\nSee you at 19:30!";

  await page.goto(`/dashboard/reservations?day=${tomorrow}`);
  const row = page.getByRole("article", { name: new RegExp(`^R-${booking.reference},`) });
  await row.getByRole("button", { name: "Message E2E Parisa" }).click();
  const dialog = page.getByRole("dialog", { name: "Message E2E Parisa" });
  await expect(dialog).toContainText(`About R-${booking.reference}`);
  await dialog.getByRole("textbox", { name: "Message" }).fill(text);
  await dialog.getByRole("button", { name: "Send" }).click();
  // The toast and its screen-reader announcement carry the same words.
  await expect(page.getByText("Message sent to E2E Parisa").first()).toBeVisible();
  await expect(dialog).toBeHidden();

  const guest = await signInAsGuest(browser, phone);
  // Waiting for them from before they had an account: counted on the profile and in the header.
  await guest.goto("/account");
  await expect(guest.getByRole("link", { name: /^Messages\s*1/ })).toBeVisible();
  await guest.getByRole("link", { name: /^Messages\s*1/ }).click();

  await expect(guest).toHaveURL(/\/messages$/);
  await expect(guest.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
  const item = guest.getByRole("listitem").filter({ hasText: "A message from the cafe" });
  await expect(item).toContainText(`About your table booking R-${booking.reference}`);
  await expect(item).toContainText("We've kept the table by the window for you.");
  await expect(item).toContainText("To reply, contact the cafe.");
  await expect(item.getByRole("img", { name: "Unread" })).toBeVisible();

  await guest.getByRole("button", { name: "Mark all as read" }).click();
  await expect(item.getByRole("img", { name: "Unread" })).toBeHidden();
  await expect(guest.getByRole("button", { name: "Mark all as read" })).toBeHidden();
  await expect(guest.getByRole("link", { name: "Messages", exact: true })).toBeVisible();

  // The old address still opens the inbox.
  await guest.goto("/notifications");
  await expect(guest).toHaveURL(/\/messages$/);
  await guest.context().close();
});

test("a guest who joined a book's line at the counter is told it's back", async ({ page, browser }) => {
  const phone = freshPhone();
  // Unique per run, in letters: a run of digits in a name reads as a figure to the
  // responsive specs, which then fault New sale for cutting the name short.
  const copy = [...phone.slice(-4)].map((digit) => "ABCDEFGHIJ"[Number(digit)]).join("");
  const title = `E2E Messages: The Blind Owl, copy ${copy}`;
  const api = await staffApi();
  const categories = await jsonOf<{ id: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));
  const book = await jsonOf<{ id: string }>(
    await api.post("/api/products", {
      data: {
        kind: "book",
        name: title,
        categoryId: categories[0].id,
        price: "350000",
        originalPrice: "",
        costPrice: "",
        imageUrl: items[0].imageUrl,
        stockQuantity: "1",
        madeToOrder: false,
        isFeatured: false,
        isPublished: true,
        badge: "",
        unit: "",
        description: "",
        nutrition: "",
        origin: "",
        dietary: [],
        taxExempt: false,
        bookAuthor: "Sadegh Hedayat",
        bookIsbn: "",
        bookAvailability: "both",
        bookCopies: "1",
        faName: "",
        faUnit: "",
        faDescription: "",
        faNutrition: "",
        faOrigin: "",
      },
    }),
  );
  const loan = await jsonOf<{ reference: number }>(
    await api.post("/api/admin/book-loans", {
      data: {
        productId: book.id,
        borrowerName: "E2E Niloofar",
        borrowerPhone: "0912 345 0000",
        dueOn: shiftCafeDay(cafeDayOf(new Date()), 14),
        note: "",
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/book-waitlist", {
      data: { productId: book.id, guestName: "E2E Hamid", guestPhone: typed(phone) },
    }),
  );
  await api.dispose();

  // The copy comes back at the desk: the guest first in line is told on the site, though they have no account.
  await page.goto("/dashboard/book-loans");
  const row = page.getByRole("article", { name: new RegExp(`^L-${loan.reference},`) });
  await row.getByRole("button", { name: "Returned" }).click();
  // The toast and its screen-reader announcement carry the same words.
  await expect(page.getByText(`L-${loan.reference} marked returned`).first()).toBeVisible();
  await expect(
    page.getByText(`E2E Hamid is first in line for ${title}. The message that it's back went to their profile`).first(),
  ).toBeVisible();

  const guest = await signInAsGuest(browser, phone);
  await guest.getByRole("link", { name: /^Messages, 1 unread/ }).click();
  await expect(guest).toHaveURL(/\/messages$/);
  await expect(guest.getByRole("listitem").filter({ hasText: `“${title}” is back on the shelf` })).toContainText(
    "You're first in line",
  );
  await guest.context().close();
});

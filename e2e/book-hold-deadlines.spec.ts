import { execSync } from "node:child_process";

import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { cafeDayOf, cafeDayRange, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * A guest told their book is back has three days to collect it. Staff see the day
 * on Book holds, the guest on their loans page; once it's gone, the background
 * jobs skip them and the next guest in line is told — and given their own day.
 *
 * The runner's timer is off in E2E: the jobs run once, on demand, from
 * `e2e/run-background-jobs.ts`, which first moves the told guest's hold back so its
 * deadline has passed. Each run seeds its own book, so the spec can run again on
 * the same database.
 */

test.use({ storageState: storageStatePath("admin") });
// The guest's page reads what the first test's job run left.
test.describe.configure({ mode: "serial" });

const TITLE = `E2E The Hold Shelf ${Date.now().toString(36)}`;
const FIRST_GUEST = "E2E Sara Ahmadi";
const NEXT_GUEST = "Test Guest";

type Hold = { id: string; productId: string; guestName: string; status: string; pickupBy?: string };

let productId = "";

/** "Nov 6" — the dashboard's short day, on the cafe's calendar. */
function shortDay(day: string): string {
  const noon = new Date(cafeDayRange(day).from.getTime() + 12 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Asia/Tehran" }).format(noon);
}

async function holds(api: APIRequestContext, view = ""): Promise<Hold[]> {
  const all = await jsonOf<Hold[]>(await api.get(`/api/admin/book-waitlist${view}`));
  return all.filter((hold) => hold.productId === productId);
}

/** A book with one copy, out on loan, with two guests in line — it comes back, so the first is told. */
test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
  const categories = await jsonOf<{ id: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));
  ({ id: productId } = await jsonOf<{ id: string }>(
    await api.post("/api/products", {
      data: {
        kind: "book",
        name: TITLE,
        categoryId: categories[0].id,
        price: "250000",
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
        bookAuthor: "E2E Author",
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
  ));
  const loan = await jsonOf<{ id: string }>(
    await api.post("/api/admin/book-loans", {
      data: {
        productId,
        borrowerName: "E2E Borrower",
        borrowerPhone: "0912 555 0101",
        dueOn: shiftCafeDay(cafeDayOf(new Date()), 14),
        note: "",
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/book-waitlist", {
      data: { productId, guestName: FIRST_GUEST, guestPhone: "0935 555 0102" },
    }),
  );
  await jsonOf(await guest.post(`/api/products/${productId}/waitlist`));
  await jsonOf(await api.patch(`/api/admin/book-loans/${loan.id}`, { data: { status: "returned" } }));
  await guest.dispose();
  await api.dispose();
});

/** A guest's row in this run's book's line on Book holds. */
function holdRow(page: Page, guestName: string): Locator {
  return page
    .locator("div")
    .filter({ has: page.getByText(TITLE, { exact: true }) })
    .filter({ has: page.locator("ol") })
    .last()
    .locator("li")
    .filter({ hasText: guestName });
}

test("staff see the day a told guest must collect by, and the jobs skip them once it's gone", async ({ page }) => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const [first] = await holds(api);
  expect(first).toMatchObject({ guestName: FIRST_GUEST, status: "notified" });
  const deadline = cafeDayOf(new Date(first.pickupBy!));
  expect(deadline).toBe(shiftCafeDay(cafeDayOf(new Date()), 3));

  await page.goto("/dashboard/book-holds");
  await expect(holdRow(page, FIRST_GUEST)).toContainText(`Collect by ${shortDay(deadline)}`);

  execSync(`npx tsx e2e/run-background-jobs.ts --expire-hold ${first.id}`, { stdio: "inherit" });

  // The guest who didn't come is closed as not collected…
  const [skipped] = await holds(api, "?view=closed");
  expect(skipped).toMatchObject({ id: first.id, status: "cancelled" });
  await page.goto("/dashboard/book-holds?tab=closed");
  await expect(holdRow(page, FIRST_GUEST)).toContainText("Not collected");

  // …and the next in line is told, with three days of their own.
  const [next] = await holds(api);
  expect(next).toMatchObject({ guestName: NEXT_GUEST, status: "notified" });
  await page.goto("/dashboard/book-holds");
  await expect(holdRow(page, NEXT_GUEST)).toContainText(`Collect by ${shortDay(cafeDayOf(new Date(next.pickupBy!)))}`);
  await api.dispose();
});

test.describe("the guest", () => {
  test.use({ storageState: storageStatePath("customer") });

  test("sees on their loans page the day to collect their book by, and is told in their inbox", async ({ page }) => {
    await page.goto("/loans");
    const item = page.locator("li").filter({ has: page.getByRole("link", { name: TITLE }) });
    await expect(item).toContainText("It's back — ask at the counter");
    const deadline = shiftCafeDay(cafeDayOf(new Date()), 3);
    const noon = new Date(cafeDayRange(deadline).from.getTime() + 12 * 60 * 60 * 1000);
    const monthDay = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "Asia/Tehran",
    }).format(noon);
    await expect(item).toContainText(`Collect it by`);
    await expect(item).toContainText(monthDay);

    await page.goto("/notifications");
    await expect(page.getByText(`“${TITLE}” is waiting for you`)).toBeVisible();
  });
});

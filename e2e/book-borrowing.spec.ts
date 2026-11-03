import { expect, request, test, type Locator, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * A guest borrows a book from its page on the site while a copy is free: it's held
 * at the counter for them, ready to collect. Staff see it ready on Book holds and
 * hand it over with "Lend now" — three weeks, with a deposit — and the loan shows
 * on Book loans and on the guest's loans page. Each run seeds its own book, so the
 * spec can run again on the same database.
 */

test.use({ storageState: storageStatePath("admin") });
// Each step picks up where the last left the book.
test.describe.configure({ mode: "serial" });

// Letters only: a run of digits in a name reads as a figure to the responsive specs.
const RUN = Date.now()
  .toString(36)
  .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);
const TITLE = `E2E The Borrowed Shelf ${RUN}`;
const GUEST = "Test Guest";

let productId = "";

/** A published book with one copy, none of it out. */
test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
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
  await api.dispose();
});

/** A guest's row in this run's book's group on Book holds. */
function holdRow(page: Page, guestName: string): Locator {
  return page
    .locator("div")
    .filter({ has: page.getByText(TITLE, { exact: true }) })
    .filter({ has: page.locator("ol") })
    .last()
    .locator("li")
    .filter({ hasText: guestName });
}

test.describe("the guest", () => {
  test.use({ storageState: storageStatePath("customer") });

  test("borrows the free copy from the book's page, and it's held for them to collect", async ({ page }) => {
    await page.goto(`/menu/${productId}`);
    await expect(page.getByText("A copy is on the shelf right now.")).toBeVisible();

    // A click before the page hydrates does nothing: try again until the hold shows.
    await expect(async () => {
      await page.getByRole("button", { name: "Borrow", exact: true }).click({ timeout: 2_000 });
      await expect(page.getByText("It's ready — collect it at the counter")).toBeVisible({ timeout: 2_000 });
    }).toPass();
    await expect(page.getByText(/^Collect it by /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel hold" })).toBeVisible();
  });
});

test("staff see it ready on Book holds and lend it now, with a deposit", async ({ page }) => {
  await page.goto("/dashboard/book-holds");
  const row = holdRow(page, GUEST);
  await expect(row).toContainText("Ready to collect");

  await row.getByRole("button", { name: "Lend now" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Lend to ${GUEST}` })).toBeVisible();
  await dialog.getByRole("button", { name: "21 days" }).click();
  await dialog.getByLabel("Deposit (optional)").fill("500000");
  await expect(dialog.getByLabel("Paid into")).toHaveValue("cash");
  await dialog.getByLabel("Note (optional)").fill("E2E spine creased");
  await dialog.getByRole("button", { name: "Record loan" }).click();
  await expect(page.getByText(new RegExp(`^Lent ${TITLE} to ${GUEST} · L-`)).first()).toBeVisible();
  await expect(dialog).toBeHidden();

  // The hold is closed as borrowed…
  await page.goto("/dashboard/book-holds?tab=closed");
  await expect(holdRow(page, GUEST)).toContainText("Borrowed");

  // …and the loan is on Book loans, three weeks out, with the deposit held.
  await page.goto(`/dashboard/book-loans?q=${encodeURIComponent(TITLE)}`);
  const loan = page.getByRole("article", { name: new RegExp(`^L-\\d+, ${TITLE}, ${GUEST}$`) });
  await expect(loan).toContainText(/Deposit held: 500,000/);
  await expect(loan).toContainText("E2E spine creased");
  const due = shiftCafeDay(cafeDayOf(new Date()), 21);
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const { items } = await jsonOf<{ items: { bookTitle: string; dueAt: string; userId?: string }[] }>(
    await api.get(`/api/admin/book-loans?q=${encodeURIComponent(TITLE)}`),
  );
  expect(items).toHaveLength(1);
  expect(cafeDayOf(new Date(items[0].dueAt))).toBe(due);
  await api.dispose();
});

test.describe("the guest, after", () => {
  test.use({ storageState: storageStatePath("customer") });

  test("sees the loan on their loans page", async ({ page }) => {
    await page.goto("/loans");
    const item = page.locator("li").filter({ hasText: TITLE });
    await expect(item).toHaveCount(1);
    await expect(item).toContainText("Due");
    await expect(item).toContainText("On loan");
  });
});

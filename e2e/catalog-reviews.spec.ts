import { expect, request, test, type APIRequestContext } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Menu group's catalog and review workflows: ticking menu items to hide and
 * show them together, filing a category under another and dragging it by
 * keyboard, and a review's life after approval — the cafe's reply on the item's
 * page, and the guest deleting their own review.
 */

test.use({ storageState: storageStatePath("admin") });

/** Tells this run's rows apart, in letters so it never reads as a figure. */
const TAG = Date.now()
  .toString(36)
  .replace(/\d/g, (digit) => "abcdefghij"[Number(digit)]);

async function admin(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A category to work in, with two items in it. */
async function seedCategory(api: APIRequestContext, name: string): Promise<{ id: string; items: string[] }> {
  const categories = await jsonOf<{ iconUrl: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));
  const category = await jsonOf<{ id: string }>(
    await api.post("/api/categories", {
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
        iconUrl: categories[0].iconUrl,
        isActive: true,
        faName: "",
      },
    }),
  );
  const names: string[] = [];
  for (const item of ["Cortado", "Flat white"]) {
    const itemName = `E2E ${item} ${TAG}`;
    await jsonOf(
      await api.post("/api/products", {
        data: {
          kind: "drink",
          name: itemName,
          categoryId: category.id,
          price: "120000",
          originalPrice: "",
          costPrice: "",
          imageUrl: items[0].imageUrl,
          stockQuantity: "20",
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
          bookAuthor: "",
          bookIsbn: "",
          bookAvailability: "sale",
          bookCopies: "",
          faName: "",
          faUnit: "",
          faDescription: "",
          faNutrition: "",
          faOrigin: "",
        },
      }),
    );
    names.push(itemName);
  }
  return { id: category.id, items: names };
}

test("an admin ticks menu items and hides, then shows them together", async ({ page }) => {
  const api = await admin();
  const category = await seedCategory(api, `E2E Bulk ${TAG}`);
  await api.dispose();

  await page.goto(`/dashboard/products?categoryId=${category.id}`);
  // Ticks before hydration are reset, so retry until the bar answers.
  await expect(async () => {
    await page.getByRole("checkbox", { name: "Select every item on this page" }).filter({ visible: true }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toBeVisible({ timeout: 1_000 });
  }).toPass();

  const bar = page.getByRole("region", { name: "Bulk actions" });
  await expect(bar.getByText("2 selected")).toBeVisible();
  await bar.getByRole("button", { name: "Hide from menu" }).click();
  await expect(page.getByText("2 items are hidden from the menu").first()).toBeVisible();
  await expect(bar).toBeHidden();

  await page
    .getByRole("checkbox", { name: `Select ${category.items[0]}` })
    .filter({ visible: true })
    .click();
  await bar.getByRole("button", { name: "Show on menu" }).click();
  await expect(page.getByText("1 item is on the menu").first()).toBeVisible();
});

test("an admin deletes ticked items after confirming", async ({ page }) => {
  const api = await admin();
  const category = await seedCategory(api, `E2E Bulk delete ${TAG}`);
  await api.dispose();

  await page.goto(`/dashboard/products?categoryId=${category.id}`);
  await expect(async () => {
    await page.getByRole("checkbox", { name: "Select every item on this page" }).filter({ visible: true }).click();
    await expect(page.getByRole("region", { name: "Bulk actions" })).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await page.getByRole("region", { name: "Bulk actions" }).getByRole("button", { name: "Delete" }).click();

  const confirm = page.getByRole("dialog");
  await expect(confirm.getByText("Delete 2 items?")).toBeVisible();
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("2 items deleted").first()).toBeVisible();
  await expect(page.getByText(category.items[0], { exact: true })).toHaveCount(0);
});

test("an admin files a category under another and reorders it by keyboard", async ({ page }) => {
  const api = await admin();
  const parent = await seedCategory(api, `E2E Parent ${TAG}`);
  await api.dispose();

  // A new subcategory, filed under the parent from the form's picker.
  const child = `E2E Child ${TAG}`;
  await page.goto("/dashboard/categories/create");
  await expect(async () => {
    await page.getByRole("group", { name: "English" }).getByLabel("Name").fill(child);
    await expect(page.getByRole("group", { name: "English" }).getByLabel("Name")).toHaveValue(child, {
      timeout: 1_000,
    });
  }).toPass();
  await page.getByLabel("Icon image").setInputFiles({
    name: "icon.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(page.getByRole("img", { name: "Category icon preview" })).toBeVisible();
  await page.getByLabel("Parent category").click();
  await page.getByRole("radiogroup", { name: "Parent category" }).getByText(`E2E Parent ${TAG}`).click();
  await page.getByRole("button", { name: "Create category" }).click();
  await expect(page).toHaveURL(/\/dashboard\/categories$/);

  // Listed under its parent.
  const subcategories = page.getByRole("list", { name: `Subcategories of E2E Parent ${TAG}` });
  await expect(subcategories.getByText(child)).toBeVisible();
  expect(parent.id).toBeTruthy();

  // The parent is last at the top level; the grip takes it up one place by keyboard.
  const grip = page.getByRole("button", { name: `Reorder E2E Parent ${TAG}` });
  await grip.focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(page.getByText(new RegExp(`E2E Parent ${TAG} moved to place \\d+`)).first()).toBeVisible();
});

test("the cafe replies to a review, and the guest sees it and deletes their own", async ({ page, browser }) => {
  const api = await admin();
  const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
  const category = await seedCategory(api, `E2E Reviewed ${TAG}`);
  const { items } = await jsonOf<{ items: { id: string; name: string }[] }>(
    await api.get(`/api/admin/products?categoryId=${category.id}`),
  );
  const item = items[0];

  // The guest had it, reviewed it, and staff approved the review.
  const order = await jsonOf<{ id: string }>(
    await guest.post("/api/orders", {
      data: { items: [{ productId: item.id, quantity: 1 }], serviceType: "takeaway" },
    }),
  );
  for (const status of ["preparing", "completed"]) {
    await jsonOf(await api.patch(`/api/admin/orders/${order.id}/status`, { data: { status } }));
  }
  const review = await jsonOf<{ id: string }>(
    await guest.put(`/api/products/${item.id}/reviews/mine`, { data: { rating: 3, comment: `E2E A bit cold ${TAG}` } }),
  );
  await jsonOf(await api.patch(`/api/admin/reviews/${review.id}`, { data: { status: "approved" } }));
  await guest.dispose();
  await api.dispose();

  // Staff reply from the queue, filtered to the item.
  await page.goto(`/dashboard/reviews?view=approved&productId=${item.id}`);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reply", { exact: true }).fill(`Sorry — we'll warm the cups ${TAG}`);
  await dialog.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText("Reply posted").first()).toBeVisible();
  await expect(page.getByText(`Sorry — we'll warm the cups ${TAG}`)).toBeVisible();

  // The guest sees it on the item's page, signed by the cafe, and has been told.
  const context = await browser.newContext({ storageState: storageStatePath("customer") });
  const guestPage = await context.newPage();
  await guestPage.goto(`/menu/${item.id}`);
  const reviews = guestPage.locator("#reviews");
  await expect(reviews.getByText(`Sorry — we'll warm the cups ${TAG}`)).toBeVisible();
  await expect(reviews.getByText(/^Reply from /)).toBeVisible();

  // And deletes their own review.
  await expect(async () => {
    await reviews.getByRole("button", { name: "Delete my review" }).click();
    await expect(guestPage.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass();
  await guestPage.getByRole("dialog").getByRole("button", { name: "Delete my review" }).click();
  await expect(guestPage.getByText("Your review is deleted").first()).toBeVisible();
  await expect(reviews.getByRole("listitem").filter({ hasText: `E2E A bit cold ${TAG}` })).toHaveCount(0);
  // The form starts afresh, ready for a new review.
  await expect(reviews.getByRole("textbox", { name: "Your review" })).toHaveValue("");
  await context.close();
});

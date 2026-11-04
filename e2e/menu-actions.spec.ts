import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { E2E_BASE_URL } from "./fixtures/env";
import { jsonOf } from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Menu group's clicks nothing else makes: a stock item's reorder level, a quick
 * count and recorded waste from its row; an item taken off the menu by its switch
 * and featured from its row; a category that still has items hidden instead of
 * deleted; a review approved then deleted; a promo code switched off, edited and
 * deleted; and a guest's points looked up by phone.
 *
 * Everything works on items this spec makes, so the seeded menu other specs order
 * from never changes under them.
 */

test.use({ storageState: storageStatePath("admin") });

const TAG = `E2E Mn ${Math.random().toString(36).replace(/\d/g, "").slice(0, 6)}`;

type StockItem = { id: string; name: string; onHand: number; reorderLevel?: number };
type Product = { id: string; name: string; isPublished: boolean; isFeatured: boolean };

async function adminApi(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
}

/** A toast's title (its live region repeats it with a prefix). */
function toast(page: Page, text: string | RegExp) {
  return page.getByText(text, typeof text === "string" ? { exact: true } : undefined).first();
}

/** A category of this spec's own, with one item on the menu in it. */
async function categoryWithItem(api: APIRequestContext, name: string): Promise<{ categoryId: string; item: Product }> {
  const icons = await jsonOf<{ iconUrl: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));
  const category = await jsonOf<{ id: string }>(
    await api.post("/api/categories", {
      data: {
        name,
        slug: name.toLowerCase().replace(/[^a-z]+/g, "-"),
        iconUrl: icons[0].iconUrl,
        isActive: true,
        faName: "",
      },
    }),
  );
  const itemName = `${name} Cortado`;
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
  const listed = await jsonOf<{ items: Product[] }>(await api.get(`/api/admin/products?categoryId=${category.id}`));
  return { categoryId: category.id, item: listed.items[0] };
}

async function productById(api: APIRequestContext, id: string): Promise<Product> {
  return jsonOf<Product>(await api.get(`/api/admin/products/${id}`));
}

test("a stock item's reorder level, a quick count and waste, from its row", async ({ page }) => {
  const api = await adminApi();
  const name = `${TAG} Oat milk`;
  const { id } = await jsonOf<{ id: string }>(
    await api.post("/api/admin/inventory/items", {
      data: { name, unit: "ml", reorderLevel: "", parLevel: "", purchaseUnits: [], supplierId: "" },
    }),
  );
  const item = async (): Promise<StockItem> => {
    const { items } = await jsonOf<{ items: StockItem[] }>(await api.get("/api/admin/inventory"));
    const found = items.find((one) => one.id === id);
    if (!found) throw new Error(`${name} isn't in stock`);
    return found;
  };

  await page.goto("/dashboard/inventory");
  const actions = page.getByRole("button", { name: `More actions for ${name}` });

  await actions.click();
  await page.getByRole("menuitem", { name: "Change reorder level" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reorder at (ml)").fill("500");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(toast(page, new RegExp(`^Reorder level for ${name} set to`))).toBeVisible();
  expect((await item()).reorderLevel).toBe(500);

  await actions.click();
  await page.getByRole("menuitem", { name: "Count stock" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Counted (ml)").fill("2000");
  await dialog.getByRole("button", { name: "Save count" }).click();
  await expect(toast(page, new RegExp(`^${name} counted`))).toBeVisible();
  expect((await item()).onHand).toBe(2000);

  await actions.click();
  await page.getByRole("menuitem", { name: "Record waste" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantity (ml)").fill("250");
  await dialog.getByLabel("Reason").fill("Past its date");
  await dialog.getByRole("button", { name: "Record waste" }).click();
  await expect(toast(page, "Waste recorded.")).toBeVisible();
  expect((await item()).onHand).toBe(1750);
  await api.dispose();
});

test("an item goes off the menu by its switch, and is featured from its row", async ({ page }) => {
  const api = await adminApi();
  const { categoryId, item } = await categoryWithItem(api, `${TAG} Switch`);

  await page.goto(`/dashboard/products?categoryId=${categoryId}`);
  await page.getByRole("switch", { name: `Show ${item.name} on the menu` }).click();
  await expect(toast(page, `${item.name} is hidden from the menu`)).toBeVisible();
  expect((await productById(api, item.id)).isPublished).toBe(false);

  await page.getByRole("button", { name: `More actions for ${item.name}` }).click();
  await page.getByRole("menuitem", { name: "Feature on the menu" }).click();
  await expect(toast(page, `${item.name} is featured on the menu`)).toBeVisible();
  expect((await productById(api, item.id)).isFeatured).toBe(true);
  await api.dispose();
});

test("a category that still has items is hidden instead of deleted", async ({ page }) => {
  const api = await adminApi();
  const name = `${TAG} Hide`;
  const { categoryId } = await categoryWithItem(api, name);

  await page.goto("/dashboard/categories");
  await page.getByRole("button", { name: `More actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`${name} still has items on the menu.`)).toBeVisible();
  await dialog.getByRole("button", { name: "Hide from menu instead" }).click();
  await expect(toast(page, `${name} is hidden from the menu`)).toBeVisible();
  const category = await jsonOf<{ isActive: boolean }>(await api.get(`/api/categories/${categoryId}`));
  expect(category.isActive).toBe(false);
  await api.dispose();
});

test("a waiting review is approved, then deleted", async ({ page }) => {
  const api = await adminApi();
  const { item } = await categoryWithItem(api, `${TAG} Review`);
  // Rung up at the counter on the test guest's phone, so it's their order — without
  // spending the guest's own order allowance — and handed over.
  await jsonOf(
    await api.post("/api/admin/orders", {
      data: {
        items: [{ productId: item.id, quantity: 1 }],
        serviceType: "takeaway",
        customerPhone: "09120000004",
        complete: true,
      },
    }),
  );
  const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
  await jsonOf(
    await guest.put(`/api/products/${item.id}/reviews/mine`, { data: { rating: 4, comment: `${TAG} Lovely crema` } }),
  );
  await guest.dispose();

  await page.goto(`/dashboard/reviews?view=pending&productId=${item.id}`);
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(toast(page, `Review of ${item.name} is now on the menu`)).toBeVisible();

  await page.goto(`/dashboard/reviews?view=approved&productId=${item.id}`);
  await page.getByRole("button", { name: `More actions for the review of ${item.name}` }).click();
  await page.getByRole("menuitem", { name: "Delete review" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(toast(page, `Review of ${item.name} deleted`)).toBeVisible();
  await page.goto(`/dashboard/reviews?view=all&productId=${item.id}`);
  await expect(page.getByText(`${TAG} Lovely crema`)).toHaveCount(0);
  await api.dispose();
});

test("a promo code is switched off, edited and deleted; a guest's points are looked up", async ({ page }) => {
  const api = await adminApi();
  // Letters only: a code is 3–16 letters and digits, and `toString(36)` starts with "0.".
  const code = `E2E${Math.random()
    .toString(36)
    .replace(/[^a-z]/g, "")
    .slice(0, 6)
    .toUpperCase()}`;
  await jsonOf(
    await api.post("/api/admin/promo-codes", {
      data: {
        code,
        description: "",
        kind: "percent",
        value: "10",
        maxDiscount: "",
        minSubtotal: "",
        startsOn: "",
        endsOn: "",
        usageLimit: "",
        perGuestLimit: "",
        isActive: true,
      },
    }),
  );
  const stored = async (): Promise<{ code: string; isActive: boolean; description?: string } | undefined> =>
    (
      await jsonOf<{ code: string; isActive: boolean; description?: string }[]>(await api.get("/api/admin/promo-codes"))
    ).find((one) => one.code === code);

  await page.goto("/dashboard/promotions");
  const live = page.getByRole("switch", { name: `${code} on` });
  await live.click();
  await expect(live).not.toBeChecked();
  await expect.poll(async () => (await stored())?.isActive).toBe(false);

  await page.getByRole("button", { name: `More actions for ${code}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Who it’s for").fill("Regulars on a rainy day");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(toast(page, `${code} saved`)).toBeVisible();
  expect((await stored())?.description).toBe("Regulars on a rainy day");

  await page.getByRole("button", { name: `More actions for ${code}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
  await expect(toast(page, `${code} deleted`)).toBeVisible();
  expect(await stored()).toBeUndefined();

  await page.getByLabel("Guest’s phone").fill("0912 000 0004");
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("Test Guest").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Add points" })).toBeVisible();
  await api.dispose();
});

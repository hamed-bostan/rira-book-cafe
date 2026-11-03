import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import {
  jsonOf,
  LOCALES,
  measureBrokenFigures,
  measureCurrentTabHidden,
  measurePageOverflow,
  measureSidewaysTables,
  measureSmallTargets,
  measureSpilledFigures,
  openWithFonts,
  VIEWPORTS,
} from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Menu pages — items, categories, stock, reviews and promotions — and the
 * dialogs they open, at a phone's, a tablet's and a laptop's width, in both
 * languages: nothing pushes the page sideways, no figure splits or runs into the
 * next column, tables fit without scrolling, the tab you're on is in view, and on
 * a phone every control is big enough for a finger.
 *
 * The menu is filled first with names as long as the forms take and prices at
 * the most an order can hold, so a layout that only fits a short name and a small
 * sum fails here.
 *
 * Pages that still fall short carry `gaps`, naming the phase of the responsive
 * plan that fixes each check: the check is expected to fail, and starts failing
 * the run the moment it passes, so the mark comes off with the fix.
 */

test.use({ storageState: storageStatePath("admin") });

/** Just under what one order can hold, so a guest can still order it. */
const PRICE = "1850000000";
/** A delivery's cost as big as a year's coffee gets. */
const BIG = "1250000000";

const CATEGORY = {
  en: "E2E Single-origin pour-overs & seasonal cold brews",
  fa: "دم‌آوری‌های تک‌خاستگاه و قهوه‌های سرددم فصلی",
};

type Seed = { categoryId: string; productId: string };

type Check = "fits" | "tables" | "tabs" | "targets";

type MenuPage = {
  path: (seed: Seed) => string;
  /** Has a table that should fit the screen. */
  table?: boolean;
  /** Has the row of tabs along its top. */
  tabs?: boolean;
  /** Opens a dialog, which is measured rather than the page under it. */
  dialog?: boolean;
  /** Something to do before measuring, like opening a dialog. */
  prepare?: (page: Page) => Promise<void>;
  /** The checks this page still fails, each with the phase of the plan that fixes it. */
  gaps?: Partial<Record<Check, string>>;
};

/** The open dialog, once it has finished zooming in: mid-animation it's drawn smaller than it is. */
async function openedDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.evaluate((element) =>
    Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
}

/** Opens the dialog behind a button, then types figures as wide as they get into its fields. */
function dialogFrom(button: RegExp, figures: readonly string[] = []): (page: Page) => Promise<void> {
  return async (page) => {
    await page.getByRole("button", { name: button }).first().click();
    const dialog = await openedDialog(page);
    for (const [index, figure] of figures.entries()) await dialog.getByRole("textbox").nth(index).fill(figure);
  };
}

/** Opens a row's "⋯" menu and picks Delete, which asks first. */
function deleteFrom(actions: RegExp): (page: Page) => Promise<void> {
  return async (page) => {
    await page.getByRole("button", { name: actions }).first().click();
    await page.getByRole("menuitem", { name: /^(Delete|حذف)$/ }).click();
    await openedDialog(page);
  };
}

const PAGES: Record<string, MenuPage> = {
  "menu items": { path: () => "/dashboard/products", tabs: true, gaps: { fits: "Phase 3" } },
  // The seeded category's tab is the last of a long row.
  "menu items in a category": {
    path: (seed) => `/dashboard/products?categoryId=${seed.categoryId}`,
    tabs: true,
    gaps: { fits: "Phase 3" },
  },
  "new menu item": { path: () => "/dashboard/products/create" },
  "menu item": { path: (seed) => `/dashboard/products/${seed.productId}/edit` },
  "missing menu item": { path: () => "/dashboard/products/e2e-missing-item/edit" },
  // The category's tab holds just the seeded item.
  "delete menu item": {
    path: (seed) => `/dashboard/products?categoryId=${seed.categoryId}`,
    dialog: true,
    prepare: deleteFrom(/^(More actions for|کارهای بیشتر برای) /),
  },
  categories: { path: () => "/dashboard/categories" },
  "new category": { path: () => "/dashboard/categories/create" },
  category: { path: (seed) => `/dashboard/categories/${seed.categoryId}/edit` },
  "missing category": { path: () => "/dashboard/categories/e2e-missing-category/edit" },
  // Whichever language the name is in, under either language's label.
  "delete category": {
    path: () => "/dashboard/categories",
    dialog: true,
    prepare: deleteFrom(new RegExp(`(${CATEGORY.en}|${CATEGORY.fa})$`)),
  },
  inventory: { path: () => "/dashboard/inventory", tabs: true },
  "inventory running low": {
    path: () => "/dashboard/inventory?level=low",
    tabs: true,
  },
  "receive delivery": {
    path: () => "/dashboard/inventory",
    dialog: true,
    prepare: dialogFrom(/^(Receive delivery|دریافت کالا)$/, ["2500000", BIG]),
  },
  "count stock": {
    path: () => "/dashboard/inventory",
    dialog: true,
    prepare: dialogFrom(/^(Count stock|انبارگردانی)$/, ["9999999.5"]),
  },
  "stock movements": {
    path: () => "/dashboard/inventory/movements",
    table: true,
  },
  "stock count": { path: () => "/dashboard/inventory/count", table: true },
  "opening stock": { path: () => "/dashboard/inventory/opening" },
  "receive delivery form": { path: () => "/dashboard/inventory/receive" },
  reviews: { path: () => "/dashboard/reviews", tabs: true },
  "all reviews": { path: () => "/dashboard/reviews?view=all", tabs: true },
  promotions: { path: () => "/dashboard/promotions" },
  "new promo code": {
    path: () => "/dashboard/promotions",
    dialog: true,
    prepare: dialogFrom(/^(New code|کد جدید)$/),
  },
};

let seed: Seed;

/**
 * A category and an item in it, both with the longest names in either language,
 * priced and stocked as high as they go; a stock item delivered in bulk and now
 * running low; promo codes at the order cap; and a guest's review, waiting.
 */
async function seedMenu(api: APIRequestContext, iconUrl: string): Promise<Seed> {
  const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
  const today = cafeDayOf(new Date());
  // Tells this run's rows apart, in letters and digits so it doesn't read as a figure in a name.
  const tag = Date.now().toString(36);

  // A picture the seed already ships, as the form requires one.
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));

  const category = await jsonOf<{ id: string }>(
    await api.post("/api/categories", {
      data: {
        name: CATEGORY.en,
        slug: `e2e-pour-overs-${tag}`,
        iconUrl,
        isActive: true,
        faName: CATEGORY.fa,
      },
    }),
  );

  const product = await jsonOf<{ id: string }>(
    await api.post("/api/products", {
      data: {
        kind: "drink",
        name: `E2E Ethiopian Yirgacheffe pour-over with oat milk, wildflower honey and cardamom ${tag}`,
        categoryId: category.id,
        price: PRICE,
        originalPrice: "1990000000",
        costPrice: BIG,
        imageUrl: items[0].imageUrl,
        stockQuantity: "999999",
        madeToOrder: false,
        isFeatured: true,
        isPublished: true,
        badge: "",
        unit: "Large carafe for the whole table",
        description: "",
        nutrition: "",
        origin: "",
        dietary: [],
        taxExempt: false,
        bookAuthor: "",
        bookIsbn: "",
        bookAvailability: "sale",
        bookCopies: "",
        faName: "دم‌آوری یرگاچفهٔ اتیوپی با شیر جوی دوسر، عسل گل‌های وحشی و هل",
        faUnit: "قوری بزرگ برای همهٔ میز",
        faDescription: "",
        faNutrition: "",
        faOrigin: "",
      },
    }),
  );

  const ingredient = await jsonOf<{ id: string }>(
    await api.post("/api/admin/ingredients", {
      data: {
        name: `E2E Washed single-origin Ethiopian espresso beans ${tag}`,
        unit: "g",
        purchasePrice: "8500000",
        purchaseQuantity: "1000",
        isActive: true,
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/inventory/receipts", {
      data: {
        date: today,
        supplierId: "",
        description: `E2E a year's espresso beans from the roastery, in one delivery ${tag}`,
        lines: [{ ingredientId: ingredient.id, quantity: "2500000", cost: BIG }],
        vatAmount: "",
        payment: "unpaid",
      },
    }),
  );
  // Below its reorder level, so it's flagged and in the "Running low" tab.
  await jsonOf(await api.patch(`/api/admin/inventory/items/${ingredient.id}`, { data: { reorderLevel: "5000000" } }));

  const code = `E2E${tag}`.toUpperCase();
  await jsonOf(
    await api.post("/api/admin/promo-codes", {
      data: {
        code,
        description: "E2E a thank-you to the book club's founding members, for their first year of Thursday evenings",
        kind: "fixed",
        value: "1950000000",
        maxDiscount: "",
        minSubtotal: "2000000000",
        startsOn: "",
        endsOn: "",
        usageLimit: "1000000",
        perGuestLimit: "1000",
        isActive: true,
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/promo-codes", {
      data: {
        code: `${code.slice(0, 13)}PC`,
        description: "",
        kind: "percent",
        value: "15",
        maxDiscount: "1950000000",
        minSubtotal: "",
        startsOn: "",
        endsOn: "",
        usageLimit: "",
        perGuestLimit: "",
        isActive: false,
      },
    }),
  );

  // A guest can only review what they've had, so they order it and the bar hands it over.
  const order = await jsonOf<{ id: string }>(
    await guest.post("/api/orders", {
      data: { items: [{ productId: product.id, quantity: 1 }], serviceType: "takeaway" },
    }),
  );
  for (const status of ["preparing", "completed"]) {
    await jsonOf(await api.patch(`/api/admin/orders/${order.id}/status`, { data: { status } }));
  }
  await jsonOf(
    await guest.put(`/api/products/${product.id}/reviews/mine`, {
      data: {
        rating: 4,
        comment:
          "E2E The pour-over was bright and floral, with a long honeyed finish; the carafe was enough for four of us after the reading group, though it took a while to arrive.",
      },
    }),
  );

  await guest.dispose();
  return { categoryId: category.id, productId: product.id };
}

/**
 * Seeds the menu once per database. A failed test starts a fresh worker, which
 * runs this again: it finds the category already there and picks up its item,
 * rather than adding another of everything (and another order the rate limit refuses).
 */
test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const categories = await jsonOf<{ id: string; name: string; iconUrl: string }[]>(await api.get("/api/categories"));
  const seeded = categories.find((category) => category.name === CATEGORY.en);
  if (seeded) {
    const { items } = await jsonOf<{ items: { id: string }[] }>(
      await api.get(`/api/admin/products?categoryId=${seeded.id}`),
    );
    seed = { categoryId: seeded.id, productId: items[0].id };
  } else {
    seed = await seedMenu(api, categories[0].iconUrl);
  }
  await api.dispose();
});

/** Opens a page at a phone's width with its fonts in, then readies it for measuring. */
async function open(page: Page, menuPage: MenuPage): Promise<void> {
  await openWithFonts(page, menuPage.path(seed));
  await menuPage.prepare?.(page);
}

for (const locale of LOCALES) {
  test.describe(`in ${locale}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: E2E_BASE_URL }]);
    });

    for (const [name, menuPage] of Object.entries(PAGES)) {
      const root = menuPage.dialog ? '[role="dialog"]' : "main";
      const gap = (check: Check): void => {
        const phase = menuPage.gaps?.[check];
        test.fail(phase !== undefined, `${phase} fixes this`);
      };

      test(`${name} fits the screen at every width`, async ({ page }) => {
        gap("fits");
        await open(page, menuPage);

        const overflows: { width: number; by: number; culprits: string[] }[] = [];
        const broken: { width: number; figures: string[] }[] = [];
        const spilled: { width: number; figures: string[] }[] = [];
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const { by, culprits } = await page.evaluate(measurePageOverflow);
          if (by > 0) overflows.push({ width: viewport.width, by, culprits });
          const split = await page.evaluate(measureBrokenFigures, root);
          if (split.length > 0) broken.push({ width: viewport.width, figures: split });
          const over = await page.evaluate(measureSpilledFigures, root);
          if (over.length > 0) spilled.push({ width: viewport.width, figures: over });
        }
        expect.soft(overflows, "the page scrolls sideways").toEqual([]);
        expect.soft(broken, "a figure splits across lines").toEqual([]);
        expect.soft(spilled, "a figure runs out of its column").toEqual([]);
      });

      test(`${name} has controls a finger can hit on a phone`, async ({ page }) => {
        gap("targets");
        await open(page, menuPage);

        expect(await page.evaluate(measureSmallTargets, root), "a control is under 44px").toEqual([]);
      });

      if (menuPage.table) {
        test(`${name} keeps its tables on screen`, async ({ page }) => {
          gap("tables");
          await open(page, menuPage);

          const scrolling: { width: number; by: number[] }[] = [];
          for (const viewport of VIEWPORTS) {
            await page.setViewportSize(viewport);
            const by = await page.evaluate(measureSidewaysTables);
            if (by.length > 0) scrolling.push({ width: viewport.width, by });
          }
          expect(scrolling, "a table scrolls sideways").toEqual([]);
        });
      }

      if (menuPage.tabs) {
        test(`${name} shows the tab it's on`, async ({ page }) => {
          gap("tabs");
          await open(page, menuPage);

          expect(await page.evaluate(measureCurrentTabHidden), "the current tab is off the edge").toBe(false);
        });
      }
    }
  });
}

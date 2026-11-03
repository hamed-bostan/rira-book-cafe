import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { cafeDayOf } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import {
  jsonOf,
  LOCALES,
  measureBrokenFigures,
  measureCurrentTabHidden,
  measureNarrowFields,
  measurePageOverflow,
  measureSidewaysTables,
  measureSmallTargets,
  measureSpilledFigures,
  openWithFonts,
  PHONE,
  VIEWPORTS,
} from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The rest of the dashboard — the overview, the Service pages (orders, a sale at
 * the counter, the bar display), Insights (reports) and the Cafe pages (activity,
 * team) — the dialogs they open, and the shell around every page, at a phone's,
 * a tablet's and a laptop's width, in both languages: nothing pushes the page
 * sideways, no figure splits or runs into the next column, no dialog field is
 * squeezed too narrow to type in, the tab you're on is in view, and on a phone
 * every control is big enough for a finger.
 *
 * Seeded with names and notes as long as the forms take and orders at the order
 * cap, so a layout that only fits a short name and a small sum fails here.
 */

test.use({ storageState: storageStatePath("admin") });

/** Just under what one order can hold, with room for a round of the small item. */
const BIG_PRICE = "1850000000";
const SMALL_PRICE = "2900000";

const CATEGORY = {
  en: "E2E Counter specials: slow bar & late-night plates",
  fa: "ویژه‌های پیشخوان: بار آرام و بشقاب‌های آخر شب",
};
const BIG = {
  en: "E2E Whole-table tasting flight of single-origin pour-overs with oat milk, honey and cardamom",
  fa: "سینی چشیدنی همهٔ میز از دم‌آوری‌های تک‌خاستگاه با شیر جو دوسر، عسل و هل",
};
const SMALL = {
  en: "E2E Saffron-and-rosewater cheesecake slice with pistachio crumble and sour-cherry compote",
  fa: "برش چیزکیک زعفران و گلاب با خردهٔ پسته و کمپوت آلبالو",
};

/** As long as a guest's name may be at the counter (80 characters). */
const NAME = "E2E Anahita Gholamhosseini-Farahabadi and Christopher Montgomery-Whitfield III";
/** As long as an order's note may be (300 characters). */
const NOTE = (
  "E2E Celebrating a fortieth birthday: please keep the corner by the window free, one guest uses a wheelchair, " +
  "two are allergic to nuts, and a cake arrives from the bakery at seven — the guests would like it brought out " +
  "with candles after the main course, before the tea service, thanks so much from all of us"
).slice(0, 300);
/** As long as a table's label may be (20 characters). */
const TABLE = "E2E Window corner 12";
const INTERNAL_NOTE =
  "E2E The guest called back about the refund: two slices came out after the candles and were sent back, so they were refunded to the card. " +
  "The receipt photo is in the shared folder at https://drive.example.com/rira/receipts/2026/11/whole-table-tasting-flight-birthday-refund-photo.jpg " +
  "— if they ask again, the manager on shift can confirm. Seyyed Mohammad-Hossein will follow up tomorrow morning before opening.";
const REFUND_REASON =
  "E2E Two slices came out after the candles and the guests had already left the table; refunded to the card at their request, with an apology from the bar".slice(
    0,
    200,
  );
const TEAM_EMAIL = "e2e.anahita.gholamhosseini-farahabadi.montgomery-whitfield@front-of-house.rira-book-cafe.example";

type Seed = {
  /** Completed, paid in parts, part-refunded, with notes: the order detail at its fullest. */
  fullOrderId: string;
  /** Still waiting for the bar, so it can be cancelled. */
  pendingOrderId: string;
};

type MeasuredPage = {
  path: (seed: Seed) => string;
  /** Signed in as someone other than the admin (Team is the owner's alone). */
  user?: "owner";
  /** Has a table that should fit the screen. */
  table?: boolean;
  /** Has the row of tabs along its top. */
  tabs?: boolean;
  /** Opens a dialog, which is measured rather than the page under it. */
  dialog?: boolean;
  /** Opens a dropdown menu, which is measured rather than the page under it. */
  menu?: boolean;
  /** A form whose fields should have room to type in, like a dialog's. */
  form?: boolean;
  /** Changes its layout once more past a laptop's width, so is measured on a desktop's too. */
  wide?: boolean;
  /** Something to do before measuring, like opening a dialog. */
  prepare?: (page: Page) => Promise<void>;
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

/** The open menu, once its animation has ended. */
async function openedMenu(page: Page): Promise<Locator> {
  const menu = page.getByRole("menu");
  await menu.waitFor();
  await menu.evaluate((element) =>
    Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return menu;
}

function dialogFrom(button: RegExp, fill?: (dialog: Locator) => Promise<void>): (page: Page) => Promise<void> {
  return async (page) => {
    await page.getByRole("button", { name: button }).first().click();
    const dialog = await openedDialog(page);
    await fill?.(dialog);
  };
}

function menuItemFrom(actions: RegExp, item: RegExp): (page: Page) => Promise<void> {
  return async (page) => {
    await page.getByRole("button", { name: actions }).first().click();
    await page.getByRole("menuitem", { name: item }).click();
    await openedDialog(page);
  };
}

function menuFrom(button: RegExp): (page: Page) => Promise<void> {
  return async (page) => {
    await page.getByRole("button", { name: button }).first().click();
    await openedMenu(page);
  };
}

const ORDER_ACTIONS = /^(Actions for order|عملیات سفارش) #/;
const MEMBER_ACTIONS = /^(More actions for|کارهای بیشتر برای) \+44/;

const PAGES: Record<string, MeasuredPage> = {
  // Its five headline cards share a row only on a desktop's screen.
  overview: { path: () => "/dashboard", wide: true },

  orders: { path: () => "/dashboard/orders", tabs: true, table: true },
  "active orders": { path: () => "/dashboard/orders?status=active", tabs: true, table: true },
  // The last tab of the row.
  "cancelled orders": { path: () => "/dashboard/orders?status=cancelled", tabs: true, table: true },
  "orders with no matches": { path: () => "/dashboard/orders?q=e2e-matches-nothing", tabs: true },
  // Rows are picked on a laptop, where the table has its checkboxes; the actions
  // that take the toolbar's place are then measured at every width.
  "selected orders": {
    path: () => "/dashboard/orders?status=active",
    prepare: async (page) => {
      await page.setViewportSize(VIEWPORTS[2]);
      await page.getByRole("checkbox", { name: /^(Select all orders|انتخاب همهٔ سفارش‌ها)/ }).check();
    },
  },
  "cancel an order from the list": {
    path: () => "/dashboard/orders?status=pending",
    dialog: true,
    prepare: menuItemFrom(ORDER_ACTIONS, /^(Cancel order|لغو سفارش)$/),
  },
  order: { path: (s) => `/dashboard/orders/${s.fullOrderId}` },
  "pending order": { path: (s) => `/dashboard/orders/${s.pendingOrderId}` },
  "pay an order in parts": {
    path: (s) => `/dashboard/orders/${s.pendingOrderId}`,
    form: true,
    prepare: async (page) => {
      const main = page.getByRole("main");
      await main.getByRole("button", { name: /^(Mark paid|ثبت پرداخت)$/ }).click();
      await main.getByRole("button", { name: /^(Split the bill|تقسیم صورت‌حساب)$/ }).click();
      await main.getByLabel(/^(Cash|نقدی)$/).fill("1328066667");
    },
  },
  "refund an order": {
    path: (s) => `/dashboard/orders/${s.fullOrderId}`,
    dialog: true,
    prepare: dialogFrom(/^(Refund|بازپرداخت)$/, async (dialog) => {
      await dialog.getByRole("textbox").last().fill(REFUND_REASON);
    }),
  },
  "cancel an order": {
    path: (s) => `/dashboard/orders/${s.pendingOrderId}`,
    dialog: true,
    prepare: dialogFrom(/^(Cancel order|لغو سفارش)$/),
  },
  "new sale": {
    path: () => "/dashboard/orders/new",
    form: true,
    prepare: async (page) => {
      const main = page.getByRole("main");
      await main.getByRole("button", { name: new RegExp(`^(Add|افزودن) (${BIG.en}|${BIG.fa})`) }).click();
      for (let i = 0; i < 3; i++) {
        await main.getByRole("button", { name: new RegExp(`^(Add|افزودن) (${SMALL.en}|${SMALL.fa})`) }).click();
      }
      await main.getByRole("button", { name: /^(Dine-in|سرو در کافه)$/ }).click();
      await main.getByRole("button", { name: /^(Split|تقسیم)$/ }).click();
      const fields = main.getByRole("textbox");
      await fields.nth(1).fill(NAME);
      await fields.nth(2).fill("0912 345 6789");
      await fields.nth(3).fill(TABLE);
      await fields.nth(4).fill(NOTE);
      await fields.nth(5).fill("1328066667");
    },
  },
  "bar display": { path: () => "/dashboard/kitchen" },

  reports: { path: () => "/dashboard/reports", tabs: true },
  "reports for 90 days": { path: () => "/dashboard/reports?range=90d", tabs: true },
  "payment report": { path: () => "/dashboard/reports/payments", tabs: true },
  "guest report": { path: () => "/dashboard/reports/guests", tabs: true },

  activity: { path: () => "/dashboard/activity" },
  "activity for orders": { path: () => "/dashboard/activity?entity=order" },
  team: { path: () => "/dashboard/team", user: "owner" },
  "change a role": {
    path: () => "/dashboard/team",
    user: "owner",
    dialog: true,
    prepare: menuItemFrom(MEMBER_ACTIONS, /^(Change role|تغییر نقش)$/),
  },
  "remove access": {
    path: () => "/dashboard/team",
    user: "owner",
    dialog: true,
    prepare: menuItemFrom(MEMBER_ACTIONS, /^(Remove access|حذف دسترسی)$/),
  },
  "transfer ownership": {
    path: () => "/dashboard/team",
    user: "owner",
    dialog: true,
    prepare: menuItemFrom(MEMBER_ACTIONS, /^(Make owner|مالک کردن)$/),
  },

  // The shell: its menus and the drawer the phone's "More" opens.
  "navigation drawer": {
    path: () => "/dashboard/reports",
    dialog: true,
    prepare: dialogFrom(/^(More options|گزینه‌های بیشتر)$/),
  },
  notifications: {
    path: () => "/dashboard/reports",
    menu: true,
    prepare: menuFrom(/^(Notifications|اعلان‌ها)/),
  },
  "account menu": {
    path: () => "/dashboard/reports",
    menu: true,
    prepare: menuFrom(/^(Account menu|منوی حساب کاربری)$/),
  },
};

let seed: Seed;

type SeededOrder = {
  id: string;
  total: number;
  status: string;
  refundedTotal: number;
  items: { id: string; productId: string }[];
};

/** A menu item's form, filled in for the seed. */
function productForm(
  name: { en: string; fa: string },
  price: string,
  categoryId: string,
  imageUrl: string,
): Record<string, unknown> {
  return {
    kind: "food",
    name: name.en,
    categoryId,
    price,
    originalPrice: "",
    costPrice: "",
    imageUrl,
    stockQuantity: "999999",
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
    faName: name.fa,
    faUnit: "",
    faDescription: "",
    faNutrition: "",
    faOrigin: "",
  };
}

async function createProduct(
  api: APIRequestContext,
  name: { en: string; fa: string },
  price: string,
  categoryId: string,
  imageUrl: string,
): Promise<string> {
  const product = await jsonOf<{ id: string }>(
    await api.post("/api/products", { data: productForm(name, price, categoryId, imageUrl) }),
  );
  return product.id;
}

/** A sale rung up at the counter for the longest name, both items, notes on each line. */
async function counterSale(
  api: APIRequestContext,
  products: { big: string; small: string },
  phone: string,
  dineIn: boolean,
): Promise<SeededOrder> {
  return jsonOf<SeededOrder>(
    await api.post("/api/admin/orders", {
      data: {
        items: [
          { productId: products.big, quantity: 1, note: NOTE },
          { productId: products.small, quantity: 50, note: NOTE.slice(0, 120) },
        ],
        serviceType: dineIn ? "dineIn" : "takeaway",
        tableLabel: dineIn ? TABLE : undefined,
        note: NOTE,
        customerName: NAME,
        customerPhone: phone,
      },
    }),
  );
}

async function moveTo(api: APIRequestContext, orderId: string, statuses: string[]): Promise<void> {
  for (const status of statuses) {
    await jsonOf(await api.patch(`/api/admin/orders/${orderId}/status`, { data: { status } }));
  }
}

async function seedAll(api: APIRequestContext, owner: APIRequestContext): Promise<Seed> {
  const tag = Date.now().toString(36);
  const today = cafeDayOf(new Date());
  const categories = await jsonOf<{ iconUrl: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));

  const category = await jsonOf<{ id: string }>(
    await api.post("/api/categories", {
      data: {
        name: CATEGORY.en,
        slug: `e2e-counter-specials-${tag}`,
        iconUrl: categories[0].iconUrl,
        isActive: true,
        faName: CATEGORY.fa,
      },
    }),
  );
  const products = {
    big: await createProduct(api, BIG, BIG_PRICE, category.id, items[0].imageUrl),
    small: await createProduct(api, SMALL, SMALL_PRICE, category.id, items[0].imageUrl),
  };
  // An edit the activity log lists as figures, before → after.
  await jsonOf(
    await api.put(`/api/products/${products.big}`, {
      data: {
        ...productForm(BIG, BIG_PRICE, category.id, items[0].imageUrl),
        originalPrice: "1990000000",
        costPrice: "1250000000",
      },
    }),
  );

  // The queue: one waiting for the bar, one being made, one handed over unpaid,
  // one cancelled — and one handed over, paid in parts, then part refunded.
  const pending = await counterSale(api, products, "0912 555 0101", true);
  const making = await counterSale(api, products, "0912 555 0102", false);
  await moveTo(api, making.id, ["preparing"]);
  const unpaid = await counterSale(api, products, "0912 555 0103", true);
  await moveTo(api, unpaid.id, ["preparing", "completed"]);
  const cancelled = await counterSale(api, products, "0912 555 0104", false);
  await moveTo(api, cancelled.id, ["cancelled"]);

  const full = await counterSale(api, products, "+44 7700 900123", true);
  await moveTo(api, full.id, ["preparing", "completed"]);
  const third = Math.floor(full.total / 3);
  await jsonOf(
    await api.patch(`/api/admin/orders/${full.id}/payment`, {
      data: {
        paymentStatus: "paid",
        paymentParts: [
          { method: "cash", amount: third },
          { method: "card", amount: third },
          { method: "transfer", amount: full.total - 2 * third },
        ],
      },
    }),
  );
  const smallLine = full.items.find((item) => item.productId === products.small);
  if (!smallLine) throw new Error("the seeded order lost its second line");
  await jsonOf(
    await api.post(`/api/admin/orders/${full.id}/refunds`, {
      data: { lines: [{ itemId: smallLine.id, quantity: 2, restock: true }], method: "card", reason: REFUND_REASON },
    }),
  );
  await jsonOf(await api.post(`/api/admin/orders/${full.id}/notes`, { data: { body: INTERNAL_NOTE } }));
  await jsonOf(await api.post(`/api/admin/orders/${pending.id}/notes`, { data: { body: INTERNAL_NOTE } }));

  // A stock item below its reorder level, so the overview warns about it.
  const ingredient = await jsonOf<{ id: string }>(
    await api.post("/api/admin/ingredients", {
      data: {
        name: `E2E Washed single-origin Ethiopian espresso beans for the slow bar ${tag}`,
        unit: "g",
        purchasePrice: "8500000",
        purchaseQuantity: "1000",
        isActive: true,
      },
    }),
  );
  await jsonOf(await api.patch(`/api/admin/inventory/items/${ingredient.id}`, { data: { reorderLevel: "5000000" } }));

  // A booking later today, for the overview's list. Once 22:30 has gone it's
  // refused as in the past, which only leaves that list empty.
  await api.post("/api/admin/reservations", {
    data: { startsAt: `${today}T22:30`, partySize: 12, guestName: NAME, guestPhone: "0912 345 6789", note: NOTE },
  });

  // Two people given access by the owner: one abroad with a long email, one admin.
  await jsonOf(
    await owner.post("/api/admin/team", { data: { phone: "+447700900123", email: TEAM_EMAIL, role: "staff" } }),
  );
  await jsonOf(await owner.post("/api/admin/team", { data: { phone: "09129998877", email: "", role: "admin" } }));

  return { fullOrderId: full.id, pendingOrderId: pending.id };
}

/**
 * Seeds once per database. A failed test starts a fresh worker, which runs this
 * again: it finds the category already there and picks up its orders, rather
 * than adding another of everything.
 */
test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const owner = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("owner") });
  const categories = await jsonOf<{ name: string }[]>(await api.get("/api/categories"));
  if (categories.some((category) => category.name === CATEGORY.en)) {
    const { items } = await jsonOf<{ items: SeededOrder[] }>(
      await api.get(`/api/admin/orders?q=${encodeURIComponent(NAME)}&pageSize=50`),
    );
    const full = items.find((order) => order.refundedTotal > 0);
    const pending = items.find((order) => order.status === "pending");
    if (!full || !pending) throw new Error("the seeded orders are missing");
    seed = { fullOrderId: full.id, pendingOrderId: pending.id };
  } else {
    seed = await seedAll(api, owner);
  }
  await api.dispose();
  await owner.dispose();
});

/** A desktop's screen, past the laptop the shared widths stop at. */
const WIDE = { width: 1920, height: 1080 };

/**
 * The narrowest screen between a tablet's and a laptop's at which the page shows
 * its table rather than cards, or null if even a laptop's doesn't. The switch is
 * on the card's width, which only grows with the screen's across that range.
 */
async function narrowestWithTable(page: Page): Promise<number | null> {
  const shows = async (width: number): Promise<boolean> => {
    await page.setViewportSize({ width, height: 800 });
    return page.locator("main table").first().isVisible();
  };
  let low: number = VIEWPORTS[1].width;
  let high: number = VIEWPORTS[2].width - 1;
  if (!(await shows(high))) return null;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (await shows(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/** Opens a page at a phone's width with its fonts in, then readies it for measuring. */
async function open(page: Page, measured: MeasuredPage): Promise<void> {
  await openWithFonts(page, measured.path(seed));
  await measured.prepare?.(page);
}

for (const locale of LOCALES) {
  test.describe(`in ${locale}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: E2E_BASE_URL }]);
    });

    for (const [name, measured] of Object.entries(PAGES)) {
      const root = measured.dialog ? '[role="dialog"]' : measured.menu ? '[role="menu"]' : "main";

      test.describe(name, () => {
        if (measured.user) test.use({ storageState: storageStatePath(measured.user) });

        test(`${name} fits the screen at every width`, async ({ page }) => {
          await open(page, measured);

          const overflows: { width: number; by: number; culprits: string[] }[] = [];
          const broken: { width: number; figures: string[] }[] = [];
          const spilled: { width: number; figures: string[] }[] = [];
          const narrow: { width: number; fields: string[] }[] = [];
          for (const viewport of [...VIEWPORTS, ...(measured.wide ? [WIDE] : [])]) {
            await page.setViewportSize(viewport);
            const { by, culprits } = await page.evaluate(measurePageOverflow);
            if (by > 0) overflows.push({ width: viewport.width, by, culprits });
            const split = await page.evaluate(measureBrokenFigures, root);
            if (split.length > 0) broken.push({ width: viewport.width, figures: split });
            const over = await page.evaluate(measureSpilledFigures, root);
            if (over.length > 0) spilled.push({ width: viewport.width, figures: over });
            // A list's own controls (the pager's rows-per-page) are compact on purpose.
            if (measured.dialog || measured.form) {
              const squeezed = await page.evaluate(measureNarrowFields, root);
              if (squeezed.length > 0) narrow.push({ width: viewport.width, fields: squeezed });
            }
          }
          expect.soft(overflows, "the page scrolls sideways").toEqual([]);
          expect.soft(broken, "a figure splits across lines").toEqual([]);
          expect.soft(spilled, "a figure runs out of its column").toEqual([]);
          expect.soft(narrow, "a field is too narrow to type in").toEqual([]);
        });

        test(`${name} has controls a finger can hit on a phone`, async ({ page }) => {
          await open(page, measured);
          await page.setViewportSize(PHONE);

          expect(await page.evaluate(measureSmallTargets, root), "a control is under 44px").toEqual([]);
        });

        if (measured.table) {
          // Also where the table is at its tightest: the narrowest screen that shows
          // it rather than the cards, its card just past the switch.
          test(`${name} keeps its tables on screen`, async ({ page }) => {
            await open(page, measured);

            const tightest = await narrowestWithTable(page);
            const scrolling: { width: number; by: number[]; pageBy: number }[] = [];
            for (const viewport of [...VIEWPORTS, ...(tightest ? [{ width: tightest, height: 800 }] : [])]) {
              await page.setViewportSize(viewport);
              const by = await page.evaluate(measureSidewaysTables);
              const pageBy = (await page.evaluate(measurePageOverflow)).by;
              if (by.length > 0 || pageBy > 0) scrolling.push({ width: viewport.width, by, pageBy });
            }
            expect(scrolling, "a table scrolls sideways").toEqual([]);
          });
        }

        if (measured.tabs) {
          test(`${name} shows the tab it's on`, async ({ page }) => {
            await open(page, measured);

            expect(await page.evaluate(measureCurrentTabHidden), "the current tab is off the edge").toBe(false);
          });
        }
      });
    }

    // The shell's own bars sit outside `main`: the top bar on every width below a
    // laptop, and the phone's tab bar along the bottom.
    test("the top bar and the tab bar have controls a finger can hit on a phone", async ({ page }) => {
      await openWithFonts(page, "/dashboard/orders");

      expect(await page.evaluate(measureSmallTargets, "header"), "a top-bar control is under 44px").toEqual([]);
      expect(await page.evaluate(measureSmallTargets, "nav.bottom-0"), "a tab is under 44px").toEqual([]);
    });
  });
}

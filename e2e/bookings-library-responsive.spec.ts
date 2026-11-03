import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

import { cafeDayOf, shiftCafeDay } from "../src/domain/entities/CafeTime";

import { E2E_BASE_URL } from "./fixtures/env";
import {
  jsonOf,
  LOCALES,
  measureBrokenFigures,
  measureCurrentTabHidden,
  measureNarrowFields,
  measurePageOverflow,
  measureSmallTargets,
  measureSpilledFigures,
  openWithFonts,
  VIEWPORTS,
} from "./fixtures/responsive";
import { storageStatePath } from "./fixtures/sessions";

/**
 * The Bookings pages (reservations, suite, events) and the Library pages (book
 * loans, book holds), and the dialogs they open, at a phone's, a tablet's and a
 * laptop's width, in both languages: nothing pushes the page sideways, no figure
 * splits or runs into the next column, no dialog field is squeezed too narrow to
 * type in, the tab you're on is in view, and on a phone every control is big
 * enough for a finger. The suite's three-week strip fits a laptop, and where it
 * scrolls its row labels stay in view.
 *
 * Seeded with names and notes as long as the forms take and figures at the order
 * cap, so a layout that only fits a short name and a small sum fails here.
 */

test.use({ storageState: storageStatePath("admin") });

const PRICE = "1950000000";
const PART_PAID = "1250000000";

const BOOK_A = "E2E The Collected Letters of a Wandering Bookseller: Cafés, Night Trains and Rainy Afternoons";
const BOOK_B = "E2E A Field Guide to the Teahouses of the Old Bazaar, with Maps, Recipes and Gossip";
const AUTHOR = "Seyyed Mohammad-Hossein Tabatabaei-Nejad and Marguerite Delacroix-Hennessy";
const EVENT_TITLE =
  "E2E Thursday night book club: a long, slow reading of One Hundred Years of Solitude, chapters nine to twelve";

/** As long as a guest's name may be (80 characters). */
const NAME = "E2E Anahita Gholamhosseini-Farahabadi and Christopher Montgomery-Whitfield III";
const NOTE =
  "E2E Celebrating a fortieth birthday: please keep the corner by the window free, one guest uses a wheelchair, two are allergic to nuts, and a cake arrives from the bakery at seven — the guests would like it brought out with candles after the main course, before the tea service, thanks";

type Seed = { tomorrow: string; eventId: string };

type MeasuredPage = {
  path: (seed: Seed) => string;
  tabs?: boolean;
  dialog?: boolean;
  prepare?: (page: Page) => Promise<void>;
};

async function openedDialog(page: Page): Promise<Locator> {
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.evaluate((element) =>
    Promise.allSettled(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
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

const PAGES: Record<string, MeasuredPage> = {
  reservations: { path: (s) => `/dashboard/reservations?day=${s.tomorrow}`, tabs: true },
  "reservations needing a reply": {
    path: (s) => `/dashboard/reservations?day=${s.tomorrow}&status=requested`,
    tabs: true,
  },
  "reservations today": { path: () => "/dashboard/reservations", tabs: true },
  "new booking": {
    path: (s) => `/dashboard/reservations?day=${s.tomorrow}`,
    dialog: true,
    prepare: dialogFrom(/^(New booking|رزرو جدید)$/, async (dialog) => {
      await dialog.getByRole("textbox").nth(0).fill(NAME);
      await dialog.getByRole("textbox").nth(2).fill(NOTE);
    }),
  },
  "confirm booking with a table": {
    path: (s) => `/dashboard/reservations?day=${s.tomorrow}&status=requested`,
    dialog: true,
    prepare: dialogFrom(/^(Confirm|تأیید)$/),
  },
  "cancel booking": {
    path: (s) => `/dashboard/reservations?day=${s.tomorrow}&status=confirmed`,
    dialog: true,
    prepare: menuItemFrom(/^(More actions for|کارهای بیشتر برای) R-/, /^(Cancel booking|لغو رزرو)$/),
  },
  "message a guest": {
    path: (s) => `/dashboard/reservations?day=${s.tomorrow}`,
    dialog: true,
    prepare: dialogFrom(/^(Message|پیام به) E2E/, async (dialog) => {
      await dialog.getByRole("textbox").fill(`${NOTE} ${NOTE}`.slice(0, 500));
    }),
  },
  suite: { path: () => "/dashboard/suite", tabs: true },
  "suite past": { path: () => "/dashboard/suite?tab=past", tabs: true },
  "new stay": {
    path: () => "/dashboard/suite",
    dialog: true,
    prepare: dialogFrom(/^(New stay|اقامت جدید)$/, async (dialog) => {
      await dialog.getByRole("textbox").nth(0).fill(NAME);
    }),
  },
  events: { path: () => "/dashboard/events", tabs: true },
  "events past": { path: () => "/dashboard/events?tab=past", tabs: true },
  "new event": { path: () => "/dashboard/events/create" },
  event: { path: (s) => `/dashboard/events/${s.eventId}/edit` },
  "hold tables": {
    path: () => "/dashboard/events",
    dialog: true,
    prepare: async (page) => {
      await dialogFrom(/^(Change tables|تغییر میزها)$/)(page);
      // The floor loads once the dialog opens.
      await page.getByRole("dialog").getByRole("checkbox").first().waitFor();
    },
  },
  "book loans": { path: () => "/dashboard/book-loans", tabs: true },
  "all book loans": { path: () => "/dashboard/book-loans?view=all", tabs: true },
  "lend a book": {
    path: () => "/dashboard/book-loans",
    dialog: true,
    prepare: dialogFrom(/^(Lend a book|امانت دادن کتاب)$/, async (dialog) => {
      await dialog.getByRole("textbox").nth(0).fill(NAME);
      await dialog.getByRole("textbox").nth(2).fill(PRICE);
    }),
  },
  "mark a loan lost": {
    path: () => "/dashboard/book-loans",
    dialog: true,
    prepare: menuItemFrom(/^(More actions for|کارهای بیشتر برای) L-/, /^(Mark lost|ثبت گم‌شدن)$/),
  },
  "book holds": { path: () => "/dashboard/book-holds", tabs: true },
  "closed book holds": { path: () => "/dashboard/book-holds?tab=closed", tabs: true },
  "add a hold": {
    path: () => "/dashboard/book-holds",
    dialog: true,
    prepare: dialogFrom(/^(Add a hold|افزودن رزرو)$/, async (dialog) => {
      await dialog.getByRole("textbox").nth(0).fill(NAME);
    }),
  },
};

let seed: Seed;

/** A book with one copy, the longest title and author, so every lending row is at its widest. */
async function createBook(api: APIRequestContext, name: string, categoryId: string, imageUrl: string): Promise<string> {
  const book = await jsonOf<{ id: string }>(
    await api.post("/api/products", {
      data: {
        kind: "book",
        name,
        categoryId,
        price: PRICE,
        originalPrice: "",
        costPrice: "",
        imageUrl,
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
        bookAuthor: AUTHOR,
        bookIsbn: "",
        bookAvailability: "both",
        bookCopies: "1",
        faName: "نامه‌های گردآوری‌شدهٔ یک کتاب‌فروش دوره‌گرد: کافه‌ها، قطارهای شبانه و بعدازظهرهای بارانی",
        faUnit: "",
        faDescription: "",
        faNutrition: "",
        faOrigin: "",
      },
    }),
  );
  return book.id;
}

async function seedAll(api: APIRequestContext): Promise<Seed> {
  const guest = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("customer") });
  const today = cafeDayOf(new Date());
  const tomorrow = shiftCafeDay(today, 1);

  // Bookings for tomorrow, so none of the times has passed: a big party still
  // waiting for a reply, and one confirmed at the long table.
  await jsonOf(
    await api.post("/api/admin/reservations", {
      data: { startsAt: `${tomorrow}T19:00`, partySize: 12, guestName: NAME, guestPhone: "0912 345 6789", note: NOTE },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/reservations", {
      data: {
        startsAt: `${tomorrow}T20:45`,
        partySize: 10,
        guestName: `${NAME.slice(0, 70)} confirmed`,
        guestPhone: "0912 345 6780",
        note: NOTE,
        tableLabel: "long",
      },
    }),
  );

  // An event that evening, holding most of the floor, with a guest who has paid part of it.
  const event = await jsonOf<{ id: string }>(
    await api.post("/api/events", {
      data: {
        kind: "bookClub",
        title: EVENT_TITLE,
        description: "",
        titleFa: "باشگاه کتاب پنجشنبه‌شب: خوانش آرام و طولانی صد سال تنهایی، فصل‌های نهم تا دوازدهم با چای و شیرینی",
        descriptionFa: "",
        imageUrl: "",
        startsAt: `${tomorrow}T17:00`,
        endsAt: `${tomorrow}T20:00`,
        capacity: "10000",
        price: PRICE,
        isPublished: true,
      },
    }),
  );
  await jsonOf(
    await api.put(`/api/admin/events/${event.id}/tables`, {
      data: { tableLabels: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    }),
  );
  const registration = await jsonOf<{ id: string }>(
    await guest.post(`/api/events/${event.id}/registrations`, { data: { seats: 1 } }),
  );
  await jsonOf(
    await api.post("/api/admin/income", {
      data: {
        date: today,
        accountCode: "4400",
        description: "E2E part of a book club ticket",
        amount: PART_PAID,
        vatAmount: "",
        method: "card",
        payerName: "Test Guest",
        sourceType: "eventRegistration",
        sourceId: registration.id,
      },
    }),
  );

  // A held stay, paid for, and a guest's request on top of it.
  const stay = await jsonOf<{ id: string }>(
    await api.post("/api/admin/suite-bookings", {
      data: {
        checkIn: tomorrow,
        checkOut: shiftCafeDay(tomorrow, 3),
        guests: 2,
        note: NOTE,
        guestName: NAME,
        guestPhone: "0912 345 6781",
      },
    }),
  );
  await jsonOf(
    await api.post("/api/admin/income", {
      data: {
        date: today,
        accountCode: "4500",
        description: "E2E the suite, three nights",
        amount: PRICE,
        vatAmount: "",
        method: "transfer",
        payerName: NAME.slice(0, 60),
        sourceType: "suiteBooking",
        sourceId: stay.id,
      },
    }),
  );
  // A guest can't ask for nights already held, so theirs come after.
  await jsonOf(
    await guest.post("/api/suite-bookings", {
      data: { checkIn: shiftCafeDay(tomorrow, 5), checkOut: shiftCafeDay(tomorrow, 7), guests: 2, note: NOTE },
    }),
  );

  // Two books, one copy each, both out with a line; one comes back, so its first guest is told.
  const categories = await jsonOf<{ id: string }[]>(await api.get("/api/categories"));
  const { items } = await jsonOf<{ items: { imageUrl: string }[] }>(await api.get("/api/admin/products?pageSize=1"));
  const bookA = await createBook(api, BOOK_A, categories[0].id, items[0].imageUrl);
  const bookB = await createBook(api, BOOK_B, categories[0].id, items[0].imageUrl);
  for (const [productId, phone] of [
    [bookA, "0912 345 6782"],
    [bookB, "0912 345 6783"],
  ] as const) {
    const loan = await jsonOf<{ id: string }>(
      await api.post("/api/admin/book-loans", {
        data: {
          productId,
          borrowerName: NAME,
          borrowerPhone: phone,
          dueOn: shiftCafeDay(today, 21),
          note: NOTE,
          depositAmount: PRICE,
          depositMethod: "cash",
        },
      }),
    );
    for (const [suffix, guestPhone] of [
      ["first", `${phone.slice(0, -2)}91`],
      ["second", `${phone.slice(0, -2)}92`],
    ]) {
      await jsonOf(
        await api.post("/api/admin/book-waitlist", {
          data: { productId, guestName: `${NAME.slice(0, 72)} ${suffix}`, guestPhone },
        }),
      );
    }
    if (productId === bookB) {
      await jsonOf(await api.patch(`/api/admin/book-loans/${loan.id}`, { data: { status: "returned" } }));
    }
  }

  await guest.dispose();
  return { tomorrow, eventId: event.id };
}

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: E2E_BASE_URL, storageState: storageStatePath("admin") });
  const events = await jsonOf<{ id: string; title: string }[]>(await api.get("/api/admin/events"));
  const seeded = events.find((event) => event.title === EVENT_TITLE);
  seed = seeded ? { tomorrow: shiftCafeDay(cafeDayOf(new Date()), 1), eventId: seeded.id } : await seedAll(api);
  await api.dispose();
});

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
      const root = measured.dialog ? '[role="dialog"]' : "main";

      test(`${name} fits the screen at every width`, async ({ page }) => {
        await open(page, measured);

        const overflows: { width: number; by: number; culprits: string[] }[] = [];
        const broken: { width: number; figures: string[] }[] = [];
        const spilled: { width: number; figures: string[] }[] = [];
        const dialogOverflow: { width: number; by: number }[] = [];
        const narrow: { width: number; fields: string[] }[] = [];
        const tiles: { width: number; lines: string[] }[] = [];
        for (const viewport of VIEWPORTS) {
          await page.setViewportSize(viewport);
          const { by, culprits } = await page.evaluate(measurePageOverflow);
          if (by > 0) overflows.push({ width: viewport.width, by, culprits });
          const split = await page.evaluate(measureBrokenFigures, root);
          if (split.length > 0) broken.push({ width: viewport.width, figures: split });
          const over = await page.evaluate(measureSpilledFigures, root);
          if (over.length > 0) spilled.push({ width: viewport.width, figures: over });
          if (measured.dialog) {
            // A dialog scrolls its own content, so a field wider than it scrolls inside rather than pushing the page.
            const inside = await page.evaluate(() => {
              const dialog = document.querySelector('[role="dialog"]');
              return dialog ? dialog.scrollWidth - dialog.clientWidth : 0;
            });
            if (inside > 1) dialogOverflow.push({ width: viewport.width, by: inside });
            const squeezed = await page.evaluate(measureNarrowFields, root);
            if (squeezed.length > 0) narrow.push({ width: viewport.width, fields: squeezed });
            // A table tile keeps its name whole and each of its lines on one line; only the reason under it may be cut short.
            const cramped = await page.evaluate(() =>
              [...document.querySelectorAll('[role="dialog"] :is([role="radio"], [role="checkbox"])')].flatMap((tile) =>
                [...tile.querySelectorAll(":scope > span")]
                  .filter((line, index) => {
                    const range = document.createRange();
                    range.selectNodeContents(line);
                    const wraps = new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size > 1;
                    return wraps || (index === 0 && line.scrollWidth > line.clientWidth + 1);
                  })
                  .map((line) => line.textContent ?? ""),
              ),
            );
            if (cramped.length > 0) tiles.push({ width: viewport.width, lines: cramped });
          }
        }
        expect.soft(overflows, "the page scrolls sideways").toEqual([]);
        expect.soft(dialogOverflow, "the dialog scrolls sideways").toEqual([]);
        expect.soft(narrow, "a field is too narrow to type in").toEqual([]);
        expect.soft(tiles, "a table tile's name is cut or a line wraps").toEqual([]);
        expect.soft(broken, "a figure splits across lines").toEqual([]);
        expect.soft(spilled, "a figure runs out of its column").toEqual([]);
      });

      test(`${name} has controls a finger can hit on a phone`, async ({ page }) => {
        await open(page, measured);

        expect(await page.evaluate(measureSmallTargets, root), "a control is under 44px").toEqual([]);
      });

      if (measured.tabs) {
        test(`${name} shows the tab it's on`, async ({ page }) => {
          await open(page, measured);

          expect(await page.evaluate(measureCurrentTabHidden), "the current tab is off the edge").toBe(false);
        });
      }
    }

    // Three weeks don't fit a phone or a tablet, so the strip scrolls there — inside
    // its card, under row labels that stay put. A laptop shows it whole.
    test("suite availability fits a laptop and keeps its row labels in view", async ({ page }) => {
      await open(page, PAGES.suite);
      const strip = page.getByRole("region", { name: /^(Availability|وضعیت اتاق)$/ });
      const scroller = strip.locator(".overflow-x-auto");
      const labels = strip.getByText(/^(Held|Requests|نگه‌داشته|درخواست‌ها)$/);
      await expect(labels).toHaveCount(2);

      const problems: string[] = [];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        // Scrolled to the last day, whichever way the language reads.
        const by = await scroller.evaluate((element) => {
          const by = element.scrollWidth - element.clientWidth;
          element.scrollLeft = getComputedStyle(element).direction === "rtl" ? -by : by;
          return by;
        });
        if (viewport.width >= 1280 && by > 1) problems.push(`at ${viewport.width} the strip scrolls ${by}px`);
        const edge = await scroller.boundingBox();
        for (const label of await labels.all()) {
          const box = await label.boundingBox();
          if (!edge || !box || box.x < edge.x - 1 || box.x + box.width > edge.x + edge.width + 1) {
            problems.push(`at ${viewport.width} "${await label.textContent()}" scrolls out of view`);
          }
        }
        // Each day's name and date sit on one line within the day's column.
        const broken = await scroller.evaluate((element) =>
          [...element.querySelectorAll(".grid > div:has(> span) > span")]
            .filter((span) => {
              const range = document.createRange();
              range.selectNodeContents(span);
              const lines = new Set([...range.getClientRects()].map((box) => Math.round(box.top)));
              const column = span.parentElement?.getBoundingClientRect().width ?? 0;
              return lines.size > 1 || span.getBoundingClientRect().width > column + 1;
            })
            .map((span) => span.textContent ?? ""),
        );
        if (broken.length > 0) problems.push(`at ${viewport.width} day headings don't fit: ${broken.join(" ")}`);
      }
      expect(problems).toEqual([]);
    });
  });
}

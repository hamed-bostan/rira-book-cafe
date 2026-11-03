import { expect, test, type Page } from "@playwright/test";

import { storageStatePath } from "./fixtures/sessions";

/**
 * A page streams in behind its `loading.tsx` skeleton, and React shows it only
 * once a short reveal timer fires. If the page hydrates before that and anything
 * above it changes a context value meanwhile, React stops waiting for the server's
 * copy and draws one of its own: two copies of the page, one of them hidden. That
 * race failed `admin-products` on CI now and then. Here the reveal is held until
 * the shell has hydrated, so the race goes the bad way every time.
 */

/** The start of React's reveal for streamed segments, in the HTML it streams. */
const REVEAL = /\$RV=function\((\w)\)\{/;

/**
 * Serves `path` with React's reveal of streamed segments held until the test calls
 * `release()`: every segment the server streamed in behind a loading skeleton
 * stays parked in its hidden `<div id="S:…">` while the page hydrates.
 */
async function holdStreamedReveal(page: Page, path: string): Promise<{ release: () => Promise<void> }> {
  await page.route(
    (url) => url.pathname === path,
    async (route) => {
      // The sidebar's links prefetch the same path as an RSC payload.
      if (route.request().resourceType() !== "document") return route.fallback();
      const response = await route.fetch();
      const html = await response.text();
      expect(html, "React's reveal script changed; update REVEAL").toMatch(REVEAL);
      await route.fulfill({ response, body: html.replace(REVEAL, "$&if(!window.__e2eRevealed)return;") });
    },
  );
  return {
    release: async () => {
      await page.evaluate(() => {
        const streamed = window as unknown as { __e2eRevealed: boolean; $RV: (batch: unknown) => void; $RB: unknown };
        streamed.__e2eRevealed = true;
        streamed.$RV(streamed.$RB);
      });
    },
  };
}

/** Marks the server's copy of the page while it's parked; returns how many headings it holds. */
async function markParkedHeading(page: Page): Promise<number> {
  return page.evaluate(() => {
    const headings = document.querySelectorAll("div[hidden][id^='S:'] h1");
    for (const heading of headings) (heading as unknown as { fromServer: boolean }).fromServer = true;
    return headings.length;
  });
}

/** With the shell hydrated: nothing above the page may have made React draw a copy of it. */
async function expectServerCopyRevealed(page: Page, release: () => Promise<void>): Promise<void> {
  await page.evaluate(() => new Promise((resolve) => requestIdleCallback(resolve, { timeout: 5000 })));
  await expect(page.locator("main h1")).toHaveCount(0);

  await release();
  const heading = page.locator("main h1");
  await expect(heading).toHaveCount(1);
  expect(await heading.evaluate((node) => (node as unknown as { fromServer?: boolean }).fromServer)).toBe(true);
}

const NO_PARKED_PAGE = "the page didn't stream in behind its skeleton, so there's no race to hold";

test.describe("dashboard", () => {
  test.use({ storageState: storageStatePath("admin") });

  async function firstId(page: Page, endpoint: string): Promise<string> {
    const list = (await (await page.request.get(endpoint)).json()) as { id: string }[];
    return list[0].id;
  }

  /** The full-page forms, and a list for good measure: every page sits under the same shell. */
  const PAGES: { name: string; path: (page: Page) => Promise<string> }[] = [
    { name: "new item", path: async () => "/dashboard/products/create" },
    { name: "edit item", path: async (page) => `/dashboard/products/${await firstId(page, "/api/products")}/edit` },
    { name: "new category", path: async () => "/dashboard/categories/create" },
    {
      name: "edit category",
      path: async (page) => `/dashboard/categories/${await firstId(page, "/api/categories")}/edit`,
    },
    { name: "new event", path: async () => "/dashboard/events/create" },
    { name: "menu items", path: async () => "/dashboard/products" },
  ];

  for (const { name, path: pathOf } of PAGES) {
    test(`${name} hydrates the page the server streamed instead of drawing its own`, async ({ page }) => {
      const path = await pathOf(page);
      const { release } = await holdStreamedReveal(page, path);
      await page.goto(path);

      expect(await markParkedHeading(page), NO_PARKED_PAGE).toBe(1);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "admin");

      await expectServerCopyRevealed(page, release);
    });
  }
});

test.describe("public site", () => {
  /** A basket left from an earlier visit, as the site stores it. */
  const STORED_BASKET = JSON.stringify({
    lines: [{ productId: "stored", name: "Espresso", imageUrl: "", kind: "drink", unitPrice: 90_000, quantity: 1 }],
  });

  for (const path of ["/menu", "/events"]) {
    test(`${path} hydrates the page the server streamed instead of drawing its own`, async ({ page }) => {
      // The header picks the stored basket up once it hydrates: the moment the
      // basket once changed a context that every page sat under.
      await page.addInitScript((basket) => window.localStorage.setItem("rira.basket.v1", basket), STORED_BASKET);
      const { release } = await holdStreamedReveal(page, path);
      await page.goto(path);

      expect(await markParkedHeading(page), NO_PARKED_PAGE).toBe(1);
      await expect(page.getByRole("link", { name: "Basket, 1 item" })).toBeVisible();

      await expectServerCopyRevealed(page, release);
    });
  }
});

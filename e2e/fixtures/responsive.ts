import { expect, type APIResponse, type Page } from "@playwright/test";

/**
 * What the responsive specs share: the widths and languages a page is measured
 * at, and the measurements themselves. Each `measure…` runs inside the page
 * (`page.evaluate`), so it can only use what the browser has — no imports.
 */

export const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
] as const;

export const PHONE = VIEWPORTS[0];

export const LOCALES = ["fa", "en"] as const;

/** The body of a call that has to succeed for the pages to have anything on them (none for a 204). */
export async function jsonOf<T>(response: APIResponse): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${response.url()} answered ${response.status()}: ${body}`).toBe(true);
  return (body ? JSON.parse(body) : undefined) as T;
}

/**
 * Opens a page at a phone's width, with its content in place of the route's
 * loading skeleton and its fonts in, so text is measured at its real size.
 * `document.fonts.ready` alone can settle before a face has even started loading,
 * leaving the fallback font's narrower text on screen, so every declared face is
 * loaded first.
 */
export async function openWithFonts(page: Page, path: string): Promise<void> {
  await page.setViewportSize(PHONE);
  await page.goto(path);
  // A page that redirects once it's loaded (a form opened by URL) navigates under
  // the waits below; they start over on the page it lands on.
  for (let attempt = 1; ; attempt++) {
    try {
      // A route's skeleton is a busy region with its "Loading…" status inside. A
      // not-found page replaces it only once the page has hydrated.
      await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]:has(> [role="status"])'));
      await page.evaluate(async () => {
        await Promise.allSettled([...document.fonts].map((face) => face.load()));
        await document.fonts.ready;
      });
      return;
    } catch (error) {
      if (attempt === 3 || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForLoadState();
    }
  }
}

/** How far the page reaches past the screen's edge, and the first few things doing it. */
export function measurePageOverflow(): { by: number; culprits: string[] } {
  const root = document.documentElement;
  const edge = root.clientWidth;
  const by = root.scrollWidth - edge;
  if (by <= 0) return { by: 0, culprits: [] };

  // Something inside a scroller or a clipped box can't push the page out.
  const contained = (element: Element): boolean => {
    for (let node = element.parentElement; node && node !== root; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== "visible") return true;
    }
    return false;
  };
  const culprits = [...document.body.querySelectorAll("*")]
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && (box.right > edge + 1 || box.left < -1) && !contained(element);
    })
    .slice(0, 3)
    .map(
      (element) =>
        `<${element.tagName.toLowerCase()} class="${element.getAttribute("class") ?? ""}"> ${(element.textContent ?? "").trim().slice(0, 80)}`,
    );
  return { by, culprits };
}

/**
 * The figures broken across two lines. The page lets any long word wrap anywhere
 * rather than spill over, so a number too wide for its box splits instead of
 * pushing the page out — readable to nobody. A figure is any run of four or more
 * digits and separators, on its own or inside a line of text ("1,250,000,000
 * Toman"): the line may wrap around it, but never through it. Digits that are part
 * of a word (a slug, a code) aren't a figure. Looks in the page's `main` unless
 * told where (an open dialog).
 */
export function measureBrokenFigures(within = "main"): string[] {
  const FIGURE = /(?<![\p{L}\p{N}_\-/.])[+\-−‎‏؜]*[\d۰-۹][\d۰-۹,٬.٫‎‏؜]{3,}%?(?![\p{L}_])/gu;
  const broken: string[] = [];
  const walker = document.createTreeWalker(document.querySelector(within) ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? "";
    for (const match of text.matchAll(FIGURE)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const lines = new Set([...range.getClientRects()].map((box) => Math.round(box.top)));
      if (lines.size > 1) broken.push(match[0]);
    }
  }
  return broken;
}

/**
 * The figures running out of their column. A figure kept on one line that's wider
 * than its grid or table cell doesn't split; it spills over the next column
 * instead, as can the unit beside it, so the whole text a figure sits in is
 * measured. A column is the nearest box laid out by a grid or a table, looking
 * through `display: contents` wrappers to the grid they join. Looks in the page's
 * `main` unless told where (an open dialog).
 */
export function measureSpilledFigures(within = "main"): string[] {
  const FIGURE = /(?<![\p{L}\p{N}_\-/.])[+\-−‎‏؜]*[\d۰-۹][\d۰-۹,٬.٫‎‏؜]{3,}%?(?![\p{L}_])/gu;
  const layoutParent = (element: Element): Element | null => {
    let parent = element.parentElement;
    while (parent && getComputedStyle(parent).display === "contents") parent = parent.parentElement;
    return parent;
  };
  const columnOf = (element: Element | null): Element | null => {
    for (let node = element; node; node = node.parentElement) {
      if (getComputedStyle(node).display === "contents") continue;
      if (getComputedStyle(node).display === "table-cell") return node;
      const parent = layoutParent(node);
      if (parent && getComputedStyle(parent).display.endsWith("grid")) return node;
    }
    return null;
  };
  const spilled: string[] = [];
  const walker = document.createTreeWalker(document.querySelector(within) ?? document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node.textContent ?? "").trim();
    if (!text.match(FIGURE)) continue;
    const column = columnOf(node.parentElement);
    if (!column || !node.parentElement?.checkVisibility()) continue;
    // The figure with whatever shares its text, such as its unit ("1,850,000,000 Toman").
    const range = document.createRange();
    range.selectNodeContents(node);
    const figure = range.getBoundingClientRect();
    const box = column.getBoundingClientRect();
    if (figure.left < box.left - 1 || figure.right > box.right + 1) spilled.push(text);
  }
  return spilled;
}

/** How far each visible table scrolls sideways inside its card. */
export function measureSidewaysTables(): number[] {
  return [...document.querySelectorAll("main table")].flatMap((table) => {
    if (!table.checkVisibility()) return [];
    let scroller = table.parentElement;
    while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowX)) {
      scroller = scroller.parentElement;
    }
    const by = scroller ? scroller.scrollWidth - scroller.clientWidth : 0;
    return by > 1 ? [by] : [];
  });
}

/** Whether the tab for the page on screen is cut off by its row's edge. */
export function measureCurrentTabHidden(): boolean {
  const tab = document.querySelector('main nav a[aria-current="page"]');
  const row = tab?.closest("nav");
  if (!tab || !row) return false;
  const tabBox = tab.getBoundingClientRect();
  const rowBox = row.getBoundingClientRect();
  return tabBox.left < rowBox.left - 1 || tabBox.right > rowBox.right + 1;
}

/**
 * The controls a finger can't reliably hit on a phone: less than 44px tall, or
 * less than 44px wide where they're an icon with no words. A control inside a
 * label counts the label's box, as tapping it does the same; a link in a sentence
 * is exempt, the way WCAG's target-size rule exempts it. Looks in the page's
 * `main` unless told where (an open dialog).
 */
export function measureSmallTargets(within = "main"): string[] {
  const MIN = 44;
  const controls = (document.querySelector(within) ?? document.body).querySelectorAll<HTMLElement>(
    ':is(a[href], button, input:not([type="hidden"]), select, textarea, [role="switch"], [role="checkbox"], [role="tab"])',
  );
  const small: string[] = [];
  for (const control of controls) {
    if (!control.checkVisibility() || control.closest("[inert], [aria-hidden='true']")) continue;
    // Visually hidden (a file input behind its button): what's tapped is the button.
    const own = control.getBoundingClientRect();
    if (own.width <= 1 || own.height <= 1) continue;
    if (control.matches("a") && control.closest("p")) continue;
    const label = control.closest("label");
    const box = (label ?? control).getBoundingClientRect();
    const words = (control.textContent ?? "").trim().length > 0 || control.matches("input, select, textarea");
    if (box.height < MIN - 0.5 || (!words && box.width < MIN - 0.5)) {
      const name =
        control.getAttribute("aria-label") ?? (control.textContent ?? "").trim().slice(0, 40) ?? control.tagName;
      small.push(`${control.tagName.toLowerCase()} "${name}" ${Math.round(box.width)}×${Math.round(box.height)}`);
    }
  }
  return small;
}

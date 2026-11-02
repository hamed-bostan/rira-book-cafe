"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";

type DashboardTabRowProps = {
  /** Names the row for assistive tech ("Filter by status"). */
  label: string;
  /** The `key` of the tab on screen: the row brings that tab into view whenever it changes. */
  current: string;
  className?: string;
  children: React.ReactNode;
};

type Overflow = { start: boolean; end: boolean };

/**
 * Whether more of the row lies past its start edge and past its end edge.
 * `scrollLeft` counts from the start in either direction — it runs negative under
 * RTL — so its size is how far along the row is.
 */
function overflowOf(row: HTMLElement): Overflow {
  const along = Math.abs(row.scrollLeft);
  const room = row.scrollWidth - row.clientWidth;
  return { start: along > 1, end: along < room - 1 };
}

/**
 * Scrolls the row just far enough to show the current tab whole and clear of the
 * edge fade, whose width is the row's scroll padding. Only the row scrolls, never
 * the page around it.
 */
function revealCurrent(row: HTMLElement, behavior: ScrollBehavior): void {
  const tab = row.querySelector('[aria-current="page"]');
  if (!tab) return;
  const style = getComputedStyle(row);
  const rowBox = row.getBoundingClientRect();
  const tabBox = tab.getBoundingClientRect();
  const left = rowBox.left + (parseFloat(style.scrollPaddingLeft) || 0);
  const right = rowBox.right - (parseFloat(style.scrollPaddingRight) || 0);
  const by = tabBox.left < left ? tabBox.left - left : tabBox.right > right ? tabBox.right - right : 0;
  if (by !== 0) row.scrollBy({ left: by, behavior });
}

/**
 * The scrolling row under `DashboardLinkTabs`. On a phone the tabs run past the
 * screen's edge, so the row keeps the current one in view and fades whichever
 * edge has more tabs past it (`.edge-fade`).
 *
 * The row opens with the current tab centred: `scroll-initial-target` places it
 * at first paint, before any script has run, where the browser supports it. After
 * that the script moves the row only as far as it must — on hydrating (the first
 * placement elsewhere), on switching tab, and when the row or its tabs change
 * width (a font arriving, a phone turned).
 */
export function DashboardTabRow({ label, current, className, children }: DashboardTabRowProps) {
  const ref = React.useRef<HTMLElement>(null);
  const [overflow, setOverflow] = React.useState<Overflow>({ start: false, end: false });
  // The first reveal lands before paint; a later switch glides, unless motion is reduced.
  const placed = React.useRef(false);

  React.useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const glide = placed.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    revealCurrent(row, glide ? "smooth" : "instant");
    placed.current = true;
  }, [current]);

  React.useEffect(() => {
    const row = ref.current;
    if (!row) return;

    const update = (): void => {
      const next = overflowOf(row);
      setOverflow((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
    };

    const resized = new ResizeObserver(() => {
      revealCurrent(row, "instant");
      update();
    });
    resized.observe(row);
    for (const tab of row.children) resized.observe(tab);
    row.addEventListener("scroll", update, { passive: true });
    return () => {
      resized.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <nav
      ref={ref}
      aria-label={label}
      data-fade-start={overflow.start ? "" : undefined}
      data-fade-end={overflow.end ? "" : undefined}
      className={cn(
        "scrollbar-hide edge-fade overflow-x-auto",
        // The snap alignment only sets where the initial target lands: the row itself never snaps.
        "[&>[aria-current=page]]:snap-center [&>[aria-current=page]]:[scroll-initial-target:nearest]",
        className,
      )}
    >
      {children}
    </nav>
  );
}

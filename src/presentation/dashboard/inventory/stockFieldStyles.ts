/**
 * A quantity with its unit inside the field. The input stays `dir="ltr"` while the
 * unit follows the page, so the room for it is kept on the physical side the unit
 * lands on: right in English, left in Persian, wide enough for «میلی‌لیتر». A phone's
 * half-width field keeps less, so "Quantity" still fits.
 */
export const UNIT_INSIDE = "pr-9 sm:pr-12 rtl:pr-3 rtl:pl-16 sm:rtl:pr-3";

/** The unit itself, past the typed number. */
export const UNIT_SUFFIX =
  "pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-body-default text-muted-foreground sm:text-body-small";

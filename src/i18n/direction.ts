import type { Locale } from "./routing";

export type Direction = "ltr" | "rtl";

// Right-to-left locales. Persian is RTL; English is LTR. Kept as data (not a boolean
// per call site) so adding another RTL locale (e.g. Arabic) is a one-line change.
const RTL_LOCALES: readonly Locale[] = ["fa"];

/** Text direction for a locale — drives the `dir` attribute on `<html>`. */
export function getLangDir(locale: Locale): Direction {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

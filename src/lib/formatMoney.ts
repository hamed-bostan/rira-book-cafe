import type { Locale } from "@/src/i18n/routing";

/**
 * Prices are stored and charged in whole Toman. Only the presentation differs by
 * locale: Persian digits and «تومان» under `fa`, Latin digits and "Toman" under `en`.
 */
const FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  fa: new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }),
  en: new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }),
};

const UNIT: Record<Locale, string> = { fa: "تومان", en: "Toman" };

/** Format a Toman amount for display in the given locale, e.g. «۱۲۰٬۰۰۰ تومان» / "120,000 Toman". */
export function formatMoney(amountToman: number, locale: Locale): string {
  return `${FORMATTERS[locale].format(Math.round(amountToman))} ${UNIT[locale]}`;
}

/** The currency word alone ("Toman" / «تومان»), for a figure set apart from its unit. */
export function moneyUnit(locale: Locale): string {
  return UNIT[locale];
}

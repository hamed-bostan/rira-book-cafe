"use client";

import { useTranslations } from "next-intl";

import type { Locale } from "@/src/i18n/routing";
import { formatMoney } from "@/src/lib/formatMoney";

/** A choice's name, and what it adds (or that it can't be had now). */
export function ProductOptionChoiceLabel({
  name,
  priceDelta,
  available,
  locale,
}: {
  name: string;
  priceDelta: number;
  available: boolean;
  locale: Locale;
}) {
  const t = useTranslations("productOptions");
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
      <span dir="auto" className="min-w-0 text-body-small [overflow-wrap:anywhere] text-foreground">
        {name}
      </span>
      <span className="text-body-caption text-muted-foreground tabular-nums">
        {!available
          ? t("unavailable")
          : priceDelta > 0
            ? t("priceDelta", { price: formatMoney(priceDelta, locale) })
            : null}
      </span>
    </span>
  );
}

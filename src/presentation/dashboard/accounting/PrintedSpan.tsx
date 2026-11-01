import { getLocale, getTranslations } from "next-intl/server";

import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";

type PrintedSpanProps = { span: { fromDay: string; toDay: string } | { asOfDay: string } };

/** Paper only: the picker is gone, so a printout says whose books these are and which dates it covers. */
export async function PrintedSpan({ span }: PrintedSpanProps) {
  const t = await getTranslations("dashAccounting");
  const tMeta = await getTranslations("meta");
  const locale = await getLocale();
  const dates =
    "asOfDay" in span
      ? `${t("period.asOf")} ${formatCafeDayMedium(span.asOfDay, locale)}`
      : t("period.caption", {
          from: formatCafeDayMedium(span.fromDay, locale),
          to: formatCafeDayMedium(span.toDay, locale),
        });

  return (
    <p className="hidden font-semibold text-foreground print:block">
      {tMeta("siteName")} · {dates}
    </p>
  );
}

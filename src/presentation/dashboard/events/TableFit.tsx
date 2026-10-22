import { useLocale, useTranslations } from "next-intl";

import { seatsAtTables } from "@/src/domain/entities/CafeTable";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

type TableFitProps = {
  tableLabels: readonly string[];
  /** The event's seats; `undefined` when it has no limit. */
  capacity: number | undefined;
  className?: string;
};

/**
 * How the held tables' seats compare to the guests expected: "14 seats held for
 * 20 guests · 6 short" in amber when they fall short, green when they cover it.
 * Shared by the event card and the "Hold tables" picker, so it renders on
 * either side.
 */
export function TableFit({ tableLabels, capacity, className }: TableFitProps) {
  const t = useTranslations("dashEvents");
  const locale = useLocale();

  const held = seatsAtTables(tableLabels);
  const short = capacity === undefined ? 0 : capacity - held;
  const values = {
    held: formatNumber(held, locale),
    capacity: formatNumber(capacity ?? 0, locale),
    short: formatNumber(short, locale),
  };

  return (
    <p
      className={cn(
        "text-body-small font-medium sm:text-body-caption",
        capacity === undefined
          ? "text-muted-foreground"
          : short > 0
            ? "text-warning-foreground"
            : "text-success-foreground",
        className,
      )}
    >
      {capacity === undefined
        ? t("seatsHeldUnlimited", values)
        : short > 0
          ? t("seatsHeldShort", values)
          : t("seatsHeld", values)}
    </p>
  );
}

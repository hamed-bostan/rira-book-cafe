import { getLocale, getTranslations } from "next-intl/server";

import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

import { formatSignedMoney } from "./reportFormat";
import { ReportPanel } from "./ReportPanel";

import type { SalesBridgeLineWire } from "./report-response-schema";

/**
 * The walk from gross sales to net revenue: what the menu prices came to, what
 * promo codes and points took off, what guests were charged, what went back as
 * refunds, and the revenue left — each beside the same line for the period before.
 * Subtotals and the total are ruled off, as a statement reads.
 */
export async function SalesBridgePanel({ lines }: { lines: SalesBridgeLineWire[] }) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const amount = (line: SalesBridgeLineWire, value: number): string =>
    line.kind === "step" ? formatSignedMoney(value, locale) : formatMoney(value, locale);

  return (
    <ReportPanel title={t("bridge.heading")} description={t("bridge.description")} className="gap-3">
      <dl className="flex flex-col">
        {lines.map((line) => {
          const ruled = line.kind === "subtotal" || line.kind === "total";
          return (
            <div
              key={line.key}
              className={cn(
                "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2",
                ruled && "border-t border-border",
                line.kind === "total" && "border-t-2 border-foreground/70",
              )}
            >
              <dt
                className={cn(
                  "text-body-default sm:text-body-small",
                  line.kind === "step" ? "ps-3 text-muted-foreground" : "font-semibold text-foreground",
                )}
              >
                {t(`bridge.line.${line.key}`)}
              </dt>
              <dd className="flex flex-col items-end">
                <span
                  className={cn(
                    "text-body-default whitespace-nowrap tabular-nums sm:text-body-small",
                    ruled || line.kind === "start" ? "font-semibold text-foreground" : "text-foreground/80",
                  )}
                >
                  {amount(line, line.amount)}
                </span>
                <span className="text-body-small whitespace-nowrap text-muted-foreground tabular-nums sm:text-body-caption">
                  {t("bridge.previous", { value: amount(line, line.previous) })}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </ReportPanel>
  );
}

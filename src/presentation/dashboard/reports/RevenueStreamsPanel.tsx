import { getLocale, getTranslations } from "next-intl/server";

import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { STACKED_TABLE } from "../stackedTableStyles";

import { changeOf, formatChange } from "./reportFormat";

import type { RevenueStreamWire } from "./report-response-schema";

const S = STACKED_TABLE.wide;

const AMOUNT_COLUMNS = ["received", "refunded", "revenue", "vat", "revenueExVat"] as const;

/**
 * Every stream the cafe earns from — orders, the suite, events, kept deposits and
 * other payments — with what came in, what went back, the revenue left, the VAT
 * inside it and the revenue without it: the figure the profit and loss statement
 * books for the stream. A table on a laptop; on a narrower card each stream stacks.
 */
export async function RevenueStreamsPanel({ streams }: { streams: RevenueStreamWire[] }) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const total = (key: (typeof AMOUNT_COLUMNS)[number] | "previousRevenue"): number =>
    streams.reduce((sum, row) => sum + row[key], 0);

  const change = (current: number, previous: number): string => {
    const moved = changeOf(current, previous);
    if (!moved) return t("noBaseline");
    return t(moved.up ? "changeUp" : "changeDown", { value: formatChange(moved.share, locale) });
  };

  return (
    <section aria-label={t("streams.heading")} className={cn(PAGE_CARD, S.frame, "overflow-hidden")}>
      <div className="flex flex-col gap-1 px-5 pt-5 pb-4">
        <h2 className="text-body-strong text-foreground">{t("streams.heading")}</h2>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">
          {t("streams.description")}
        </p>
      </div>
      <table className={cn(ROW_TEXT, S.table)}>
        <thead className={cn(TABLE_HEAD, S.head)}>
          <tr>
            <th scope="col" className={TABLE_TH}>
              {t("streams.column.stream")}
            </th>
            {AMOUNT_COLUMNS.map((key) => (
              <th key={key} scope="col" className={cn(TABLE_TH, "w-36 text-end whitespace-normal")}>
                {t(`streams.column.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn(S.body, "divide-y divide-border border-t border-border")}>
          {streams.map((row) => (
            <tr key={row.stream} className={S.row}>
              <th scope="row" className={cn(S.lead, "text-start font-medium text-foreground")}>
                {t(`streams.stream.${row.stream}`)}
              </th>
              {AMOUNT_COLUMNS.map((key) => (
                <td key={key} className={cn(S.cell, S.amount, key === "revenue" && "font-semibold")}>
                  <span className={S.label}>{t(`streams.column.${key}`)}</span>
                  {formatNumber(row[key], locale)}
                  {key === "revenue" ? (
                    <span className="block text-body-small font-normal text-muted-foreground sm:text-body-caption">
                      {change(row.revenue, row.previousRevenue)}
                    </span>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot className={cn(S.foot, "border-t border-border bg-muted font-semibold")}>
          <tr className={S.row}>
            <th scope="row" className={cn(S.lead, "text-start font-semibold")}>
              {t("streams.total")}
            </th>
            {AMOUNT_COLUMNS.map((key) => (
              <td key={key} className={cn(S.cell, S.amount)}>
                <span className={S.label}>{t(`streams.column.${key}`)}</span>
                {formatNumber(total(key), locale)}
                {key === "revenue" ? (
                  <span className="block text-body-small font-normal text-muted-foreground sm:text-body-caption">
                    {change(total("revenue"), total("previousRevenue"))}
                  </span>
                ) : null}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="border-t border-border px-5 py-3 text-body-small text-pretty text-muted-foreground sm:text-body-caption">
        {t("streams.hint")}
      </p>
    </section>
  );
}

import { getLocale, getTranslations } from "next-intl/server";

import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { STACKED_TABLE } from "../stackedTableStyles";

import type { RevenueStreamWire } from "./report-response-schema";

const S = STACKED_TABLE.compact;

const COLUMNS = ["revenue", "vat", "revenueExVat"] as const;

/**
 * The VAT inside the range's revenue, stream by stream — as each sale and payment
 * booked it, less what went back with refunds — beside the revenue with and
 * without it. Streams that took nothing are left out.
 */
export async function VatSplitPanel({ streams }: { streams: RevenueStreamWire[] }) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();
  const rows = streams.filter((row) => row.revenue !== 0 || row.vat !== 0);
  const total = (key: (typeof COLUMNS)[number]): number => rows.reduce((sum, row) => sum + row[key], 0);

  return (
    <section aria-label={t("vat.heading")} className={cn(PAGE_CARD, S.frame, "overflow-hidden")}>
      <div className="flex flex-col gap-1 px-5 pt-5 pb-4">
        <h2 className="text-body-strong text-foreground">{t("vat.heading")}</h2>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("vat.description")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-border px-5 py-4 text-body-default text-muted-foreground sm:text-body-small">
          {t("vat.empty")}
        </p>
      ) : (
        <table className={cn(ROW_TEXT, S.table)}>
          <thead className={cn(TABLE_HEAD, S.head)}>
            <tr>
              <th scope="col" className={TABLE_TH}>
                {t("streams.column.stream")}
              </th>
              {COLUMNS.map((key) => (
                <th key={key} scope="col" className={cn(TABLE_TH, "w-36 text-end whitespace-normal")}>
                  {t(`streams.column.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn(S.body, "divide-y divide-border border-t border-border")}>
            {rows.map((row) => (
              <tr key={row.stream} className={S.row}>
                <th scope="row" className={cn(S.lead, "text-start font-medium text-foreground")}>
                  {t(`streams.stream.${row.stream}`)}
                </th>
                {COLUMNS.map((key) => (
                  <td key={key} className={cn(S.cell, S.amount, key === "vat" && "font-semibold")}>
                    <span className={S.label}>{t(`streams.column.${key}`)}</span>
                    {formatNumber(row[key], locale)}
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
              {COLUMNS.map((key) => (
                <td key={key} className={cn(S.cell, S.amount)}>
                  <span className={S.label}>{t(`streams.column.${key}`)}</span>
                  {formatNumber(total(key), locale)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

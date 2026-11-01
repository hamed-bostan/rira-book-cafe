import { getLocale, getTranslations } from "next-intl/server";

import type { TrialBalance } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";

import { accountName } from "./accounting-format";
import { BalanceCheck } from "./BalanceCheck";
import { StatementHeader } from "./StatementHeader";

/** Every account with movement, netted to its debit or credit side, and the two columns' totals. */
export async function TrialBalanceScreen({ report }: { report: TrialBalance }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader slug="trial-balance" span={report} />
      <BalanceCheck ok={report.balanced} okLabel={t("tb.balanced")} failLabel={t("tb.unbalanced")} />
      <section className={cn(PAGE_CARD, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className={cn(ROW_TEXT, "w-full min-w-lg table-fixed")}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th scope="col" className={TABLE_TH}>
                  {t("entry.colAccount")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                  {t("entry.colDebit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-44 text-end")}>
                  {t("entry.colCredit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.rows.map((row) => {
                const net = row.debit - row.credit;
                return (
                  <tr key={row.account.code}>
                    <td className={TABLE_TD}>
                      <Link
                        href={`/dashboard/accounting/accounts/${row.account.code}`}
                        className="text-foreground transition-colors hover:text-primary"
                      >
                        <span className={cn(ROW_CAPTION, "me-2 tabular-nums")}>{row.account.code}</span>
                        {accountName(row.account, locale)}
                      </Link>
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{net > 0 ? formatNumber(net, locale) : ""}</td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{net < 0 ? formatNumber(-net, locale) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted font-semibold">
              <tr>
                <th scope="row" className={cn(TABLE_TD, "text-start font-semibold")}>
                  {t("entry.totals")}
                </th>
                <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(report.totalDebit, locale)}</td>
                <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(report.totalCredit, locale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

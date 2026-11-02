import { getLocale, getTranslations } from "next-intl/server";

import type { AccountLedger } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardBackLink } from "../DashboardBackLink";
import { PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";
import { STACKED_TABLE } from "../stackedTableStyles";

import { accountName } from "./accounting-format";
import { PeriodPicker } from "./PeriodPicker";

const S = STACKED_TABLE.wide;

/**
 * One account's movements over a period, opening to closing, with a running
 * balance. On a narrow card each movement leads with what it was, its date, entry
 * and figures labelled beneath.
 */
export async function AccountLedgerScreen({ ledger }: { ledger: AccountLedger }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const { account } = ledger;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={account.code} />
      <DashboardBackLink href="/dashboard/accounting/accounts">{t("accounts.heading")}</DashboardBackLink>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="dashboard-page-title">
          <span dir="ltr">{account.code}</span> · {accountName(account, locale)}
        </h1>
        <Badge size="compact" variant="neutral" appearance="outline">
          {t(`accountType.${account.type}`)}
        </Badge>
      </div>

      <div className={cn(PAGE_CARD, "px-5 py-4")}>
        <PeriodPicker fromDay={ledger.fromDay} toDay={ledger.toDay} />
      </div>

      <section className={cn(PAGE_CARD, S.frame, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className={cn(ROW_TEXT, S.table)}>
            <thead className={cn(TABLE_HEAD, S.head)}>
              <tr>
                <th scope="col" className={cn(TABLE_TH, "w-32")}>
                  {t("journal.colDate")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-24")}>
                  {t("journal.colNumber")}
                </th>
                <th scope="col" className={TABLE_TH}>
                  {t("journal.colDescription")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-32 text-end")}>
                  {t("entry.colDebit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-32 text-end")}>
                  {t("entry.colCredit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("ledger.colBalance")}
                </th>
              </tr>
            </thead>
            <tbody className={cn(S.body, "divide-y divide-border")}>
              <tr className={cn(S.pairRow, "bg-muted")}>
                <td colSpan={5} className={cn(S.cell, "font-semibold text-muted-foreground")}>
                  {t("ledger.opening")}
                </td>
                <td className={cn(S.cell, S.amount, "font-semibold")}>{formatNumber(ledger.openingBalance, locale)}</td>
              </tr>
              {ledger.lines.length === 0 ? (
                <tr className={S.wholeRow}>
                  <td colSpan={6} className={cn(S.wholeCell, "px-5 py-12 text-center font-semibold text-foreground")}>
                    {t("ledger.empty")}
                  </td>
                </tr>
              ) : (
                ledger.lines.map((line, index) => (
                  <tr key={`${line.entryId}-${index}`} className={S.row}>
                    <td className={cn(S.cell, "whitespace-nowrap text-muted-foreground")}>
                      <span className={S.label}>{t("journal.colDate")}</span>
                      {formatCafeDayMedium(line.date, locale)}
                    </td>
                    <td className={S.cell}>
                      <span className={S.label}>{t("journal.colNumber")}</span>
                      <Link
                        href={`/dashboard/accounting/journal/${line.entryId}`}
                        className="w-fit font-medium text-primary hover:text-primary-hover"
                      >
                        JE-{line.number}
                      </Link>
                    </td>
                    {/* What it was leads the row when stacked. */}
                    <td className={cn(S.lead, "order-first [overflow-wrap:anywhere] text-foreground")} dir="auto">
                      {line.memo ?? line.description}
                    </td>
                    <td className={cn(S.cell, S.amount, !line.debit && "hidden")}>
                      <span className={S.label}>{t("entry.colDebit")}</span>
                      {line.debit ? formatNumber(line.debit, locale) : ""}
                    </td>
                    <td className={cn(S.cell, S.amount, !line.credit && "hidden")}>
                      <span className={S.label}>{t("entry.colCredit")}</span>
                      {line.credit ? formatNumber(line.credit, locale) : ""}
                    </td>
                    <td className={cn(S.cell, S.amount, "font-semibold text-foreground")}>
                      <span className={S.label}>{t("ledger.colBalance")}</span>
                      {formatNumber(line.runningBalance, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className={cn(S.foot, "border-t border-border bg-muted font-semibold")}>
              <tr className={S.pairRow}>
                <th scope="row" colSpan={5} className={cn(S.cell, "text-start font-semibold")}>
                  {t("ledger.closing")}
                </th>
                <td className={cn(S.cell, S.amount)}>{formatNumber(ledger.closingBalance, locale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";

import type { AccountLedger } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardBackLink } from "../DashboardBackLink";
import { AMOUNT, PAGE_CARD, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { accountName } from "./accounting-format";
import { PeriodPicker } from "./PeriodPicker";

/** One account's movements over a period, opening to closing, with a running balance. */
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

      <section className={cn(PAGE_CARD, "overflow-hidden")}>
        <div className="overflow-x-auto">
          <table className={cn(ROW_TEXT, "w-full min-w-2xl table-fixed")}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th scope="col" className={cn(TABLE_TH, "w-36")}>
                  {t("journal.colDate")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-24")}>
                  {t("journal.colNumber")}
                </th>
                <th scope="col" className={TABLE_TH}>
                  {t("journal.colDescription")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("entry.colDebit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("entry.colCredit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-44 text-end")}>
                  {t("ledger.colBalance")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr className="bg-muted">
                <td colSpan={5} className={cn(TABLE_TD, "font-semibold text-muted-foreground")}>
                  {t("ledger.opening")}
                </td>
                <td className={cn(TABLE_TD, AMOUNT, "font-semibold")}>{formatNumber(ledger.openingBalance, locale)}</td>
              </tr>
              {ledger.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center font-semibold text-foreground">
                    {t("ledger.empty")}
                  </td>
                </tr>
              ) : (
                ledger.lines.map((line, index) => (
                  <tr key={`${line.entryId}-${index}`}>
                    <td className={cn(TABLE_TD, "whitespace-nowrap text-muted-foreground")}>
                      {formatCafeDayMedium(line.date, locale)}
                    </td>
                    <td className={TABLE_TD}>
                      <Link
                        href={`/dashboard/accounting/journal/${line.entryId}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        JE-{line.number}
                      </Link>
                    </td>
                    <td className={cn(TABLE_TD, "text-foreground")} dir="auto">
                      {line.memo ?? line.description}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{line.debit ? formatNumber(line.debit, locale) : ""}</td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{line.credit ? formatNumber(line.credit, locale) : ""}</td>
                    <td className={cn(TABLE_TD, AMOUNT, "font-semibold text-foreground")}>
                      {formatNumber(line.runningBalance, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="border-t border-border bg-muted font-semibold">
              <tr>
                <th scope="row" colSpan={5} className={cn(TABLE_TD, "text-start font-semibold")}>
                  {t("ledger.closing")}
                </th>
                <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(ledger.closingBalance, locale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

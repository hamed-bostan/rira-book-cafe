import { getLocale, getTranslations } from "next-intl/server";

import type { PrintedJournal } from "@/src/domain/entities/AccountingReports";
import type { Account } from "@/src/domain/entities/Ledger";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardPageHeader } from "../DashboardPageHeader";
import { FormAlert } from "../FormAlert";
import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { accountingExports } from "./accounting-api";
import { accountLabel, entryTotal } from "./accounting-format";
import { ExportCsvLink } from "./ExportCsvLink";
import { PeriodPicker } from "./PeriodPicker";
import { PrintButton } from "./PrintButton";
import { PrintedSpan } from "./PrintedSpan";

type JournalPrintScreenProps = {
  journal: PrintedJournal;
  accounts: Account[];
  /** The filters it came with, kept when the period changes and carried into the export. */
  filters: Record<string, string>;
};

/**
 * The journal as a document: every entry in the period with all its lines, oldest
 * first, rather than the screen's one page of them. The journal page would print
 * only the rows it had loaded, and say nothing about the rest.
 */
export async function JournalPrintScreen({ journal, accounts, filters }: JournalPrintScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const { fromDay, toDay, entries, total } = journal;
  const printedTotal = entries.reduce((sum, entry) => sum + entryTotal(entry), 0);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("export.journalTitle")} />
      <DashboardPageHeader
        backHref="/dashboard/accounting/journal"
        backLabel={t("journal.heading")}
        title={t("journal.heading")}
        subtitle={t("export.journalSubtitle")}
        actions={
          <>
            <ExportCsvLink href={accountingExports.journalHref({ ...filters, from: fromDay, to: toDay, locale })} />
            <PrintButton />
          </>
        }
      />
      <PrintedSpan span={journal} />
      <div className={cn(PAGE_CARD, "px-5 py-4 print:hidden")}>
        <PeriodPicker fromDay={fromDay} toDay={toDay} keep={filters} />
      </div>

      {total > entries.length ? (
        <FormAlert>
          {t("export.tooMany", { total: formatNumber(total, locale), shown: formatNumber(entries.length, locale) })}
        </FormAlert>
      ) : null}

      {entries.length > 0 ? (
        <section className={cn(PAGE_CARD, "overflow-hidden")}>
          <div className="overflow-x-auto">
            <table className={cn(ROW_TEXT, "w-full min-w-lg")}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th scope="col" className={TABLE_TH}>
                    {t("entry.colAccount")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("entry.colDebit")}
                  </th>
                  <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                    {t("entry.colCredit")}
                  </th>
                </tr>
              </thead>
              {entries.map((entry) => (
                <tbody key={entry.id} className="break-inside-avoid border-t border-border">
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={3}
                      className={cn(TABLE_TD, "bg-muted text-start font-normal print:py-1")}
                    >
                      <span className="font-semibold text-foreground">JE-{entry.number}</span>
                      <span className={cn(ROW_CAPTION, "ms-2")}>
                        {formatCafeDayMedium(entry.date, locale)} · {t(`source.${entry.source}`)}
                        {entry.reversedById ? ` · ${t("journal.reversed")}` : ""}
                      </span>
                      <span className="block text-foreground" dir="auto">
                        {entry.description}
                      </span>
                    </th>
                  </tr>
                  {entry.lines.map((line, index) => {
                    const account = byCode.get(line.accountCode);
                    return (
                      <tr key={index}>
                        <td className={cn(TABLE_TD, "print:py-1")}>
                          {account ? accountLabel(account, locale) : line.accountCode}
                          {line.memo ? (
                            <span className={cn(ROW_CAPTION, "block")} dir="auto">
                              {line.memo}
                            </span>
                          ) : null}
                        </td>
                        <td className={cn(TABLE_TD, AMOUNT, "print:py-1")}>
                          {line.debit ? formatNumber(line.debit, locale) : ""}
                        </td>
                        <td className={cn(TABLE_TD, AMOUNT, "print:py-1")}>
                          {line.credit ? formatNumber(line.credit, locale) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
              <tfoot className="border-t border-border bg-muted font-semibold">
                <tr>
                  <th scope="row" className={cn(TABLE_TD, "text-start font-semibold")}>
                    {t("entry.totals")}
                  </th>
                  <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(printedTotal, locale)}</td>
                  <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(printedTotal, locale)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : (
        <DashboardEmptyState title={t("journal.emptyTitle")} body={t("export.journalEmpty")} />
      )}
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";

import { isReversibleSource, type Account, type JournalEntry } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { DashboardSection } from "../DashboardSection";
import { AMOUNT, ROW_TEXT, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { accountLabel, entryTotal, sourceHref, sourceLinkKey } from "./accounting-format";
import { ReverseEntryButton } from "./ReverseEntryButton";

/** A line above the entry saying what else it's tied to. */
const NOTICE = "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card-lg px-4 py-3";

type JournalEntryScreenProps = {
  entry: JournalEntry;
  accounts: Account[];
  canWrite: boolean;
  /** Today, as a cafe day — the reversal date's default and upper bound. */
  today: string;
};

/** One journal entry: its lines, who posted it, what it came from, and its reversal if any. */
export async function JournalEntryScreen({ entry, accounts, canWrite, today }: JournalEntryScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const total = entryTotal(entry);
  const documentHref = sourceHref(entry);
  const reversible = isReversibleSource(entry.source) && !entry.reversedById;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={`JE-${entry.number}`} />
      <DashboardPageHeader
        backHref="/dashboard/accounting/journal"
        backLabel={t("journal.heading")}
        title={t("entry.title", { number: entry.number })}
        badge={
          <Badge size="compact" variant="neutral" appearance="outline">
            {t(`source.${entry.source}`)}
          </Badge>
        }
        subtitle={t("entry.postedBy", {
          name: entry.createdByName,
          at: `${formatOrderDateShort(entry.createdAt, locale)} ${formatOrderTime(entry.createdAt, locale)}`,
        })}
        actions={
          canWrite && reversible ? (
            <ReverseEntryButton entryId={entry.id} number={entry.number} entryDate={entry.date} today={today} />
          ) : undefined
        }
      />

      {entry.reversedById ? (
        <p
          role="status"
          className={cn(NOTICE, ROW_TEXT, "border border-warning-border bg-warning text-warning-foreground")}
        >
          <span className="font-medium">{t("entry.reversedNotice")}</span>
          <Link
            href={`/dashboard/accounting/journal/${entry.reversedById}`}
            className="font-medium underline underline-offset-4"
          >
            {t("entry.viewReversal")}
          </Link>
        </p>
      ) : null}
      {entry.reversesId ? (
        <p role="status" className={cn(NOTICE, ROW_TEXT, "border border-info-border bg-info text-info-foreground")}>
          <span className="font-medium">{t("entry.reversesNotice")}</span>
          <Link
            href={`/dashboard/accounting/journal/${entry.reversesId}`}
            className="font-medium underline underline-offset-4"
          >
            {t("entry.viewOriginal")}
          </Link>
        </p>
      ) : null}
      {documentHref ? (
        <p className={cn(NOTICE, ROW_TEXT, "bg-muted text-foreground/80")}>
          <span>{t("entry.automaticNotice")}</span>
          <Link href={documentHref} className="font-medium text-primary hover:text-primary-hover">
            {t(sourceLinkKey(entry.source))}
          </Link>
        </p>
      ) : null}

      <DashboardSection
        title={<span dir="auto">{entry.description}</span>}
        description={formatCafeDayMedium(entry.date, locale)}
        className="overflow-hidden"
        flush
      >
        <div className="overflow-x-auto">
          <table className={cn(ROW_TEXT, "w-full min-w-xl table-fixed")}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th scope="col" className={TABLE_TH}>
                  {t("entry.colAccount")}
                </th>
                <th scope="col" className={TABLE_TH}>
                  {t("entry.colMemo")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-36 text-end")}>
                  {t("entry.colDebit")}
                </th>
                <th scope="col" className={cn(TABLE_TH, "w-40 text-end")}>
                  {t("entry.colCredit")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entry.lines.map((line, index) => {
                const account = byCode.get(line.accountCode);
                return (
                  <tr key={index}>
                    <td className={TABLE_TD}>
                      <Link
                        href={`/dashboard/accounting/accounts/${line.accountCode}`}
                        className="font-medium text-primary hover:text-primary-hover"
                      >
                        {account ? accountLabel(account, locale) : line.accountCode}
                      </Link>
                    </td>
                    <td className={cn(TABLE_TD, "text-muted-foreground")} dir="auto">
                      {line.memo ?? ""}
                    </td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{line.debit ? formatNumber(line.debit, locale) : ""}</td>
                    <td className={cn(TABLE_TD, AMOUNT)}>{line.credit ? formatNumber(line.credit, locale) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border bg-muted font-semibold">
              <tr>
                <th scope="row" colSpan={2} className={cn(TABLE_TD, "text-start font-semibold")}>
                  {t("entry.totals")}
                </th>
                <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(total, locale)}</td>
                <td className={cn(TABLE_TD, AMOUNT)}>{formatNumber(total, locale)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
}

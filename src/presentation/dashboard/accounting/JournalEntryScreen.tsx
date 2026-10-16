import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { Account, JournalEntry } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatOrderDateShort, formatOrderTime } from "@/src/lib/formatOrderDate";
import { Badge } from "@/src/presentation/design-system";

import { accountLabel, entryTotal, sourceHref } from "./accounting-format";
import { ReverseEntryButton } from "./ReverseEntryButton";

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
  const reversible = entry.source === "manual" && !entry.reversedById;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <nav aria-label={t("breadcrumbLabel")} className="flex items-center gap-2 text-body-caption text-muted-foreground">
        <Link href="/dashboard/accounting/journal" className="hover:text-foreground">
          {t("journal.heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">JE-{entry.number}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="dashboard-page-title">{t("entry.title", { number: entry.number })}</h1>
          <p className="text-body text-foreground" dir="auto">
            {entry.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-body-caption text-muted-foreground">
            <Badge size="sm" variant={entry.source === "manual" ? "info" : "neutral"}>
              {t(`source.${entry.source}`)}
            </Badge>
            <span>{formatCafeDayMedium(entry.date, locale)}</span>
            <span>·</span>
            <span>
              {t("entry.postedBy", {
                name: entry.createdByName,
                at: `${formatOrderDateShort(entry.createdAt, locale)} ${formatOrderTime(entry.createdAt, locale)}`,
              })}
            </span>
          </div>
        </div>
        {canWrite && reversible ? <ReverseEntryButton entryId={entry.id} number={entry.number} entryDate={entry.date} today={today} /> : null}
      </div>

      <div className="flex flex-col gap-2">
        {entry.reversedById ? (
          <p className="rounded-card-md border border-warning-foreground bg-warning px-4 py-3 text-body-small text-warning-foreground">
            {t("entry.reversedNotice")}{" "}
            <Link href={`/dashboard/accounting/journal/${entry.reversedById}`} className="font-medium underline underline-offset-4">
              {t("entry.viewReversal")}
            </Link>
          </p>
        ) : null}
        {entry.reversesId ? (
          <p className="rounded-card-md border border-border bg-surface px-4 py-3 text-body-small text-foreground">
            {t("entry.reversesNotice")}{" "}
            <Link href={`/dashboard/accounting/journal/${entry.reversesId}`} className="font-medium text-primary underline underline-offset-4">
              {t("entry.viewOriginal")}
            </Link>
          </p>
        ) : null}
        {documentHref ? (
          <p className="text-body-small text-muted-foreground">
            {t("entry.automaticNotice")}{" "}
            <Link href={documentHref} className="font-medium text-primary underline underline-offset-4">
              {entry.source.startsWith("order") ? t("entry.viewOrder") : t("entry.viewExpense")}
            </Link>
          </p>
        ) : null}
      </div>

      <section className="min-w-0 overflow-x-auto rounded-card-lg border border-border bg-background">
        <table className="w-full min-w-[36rem] text-body-small">
          <thead className="bg-surface text-body-caption text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("entry.colAccount")}</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">{t("entry.colMemo")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("entry.colDebit")}</th>
              <th scope="col" className="px-4 py-3 text-end font-medium">{t("entry.colCredit")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entry.lines.map((line, index) => {
              const account = byCode.get(line.accountCode);
              return (
                <tr key={index}>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/accounting/accounts/${line.accountCode}`} className="text-foreground underline-offset-4 hover:underline">
                      {account ? accountLabel(account, locale) : line.accountCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="auto">
                    {line.memo ?? ""}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">{line.debit ? formatMoney(line.debit, locale) : ""}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">{line.credit ? formatMoney(line.credit, locale) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-surface text-body-small-emphasis">
            <tr>
              <th scope="row" colSpan={2} className="px-4 py-3 text-start">
                {t("entry.totals")}
              </th>
              <td className="whitespace-nowrap px-4 py-3 text-end">{formatMoney(total, locale)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-end">{formatMoney(total, locale)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}

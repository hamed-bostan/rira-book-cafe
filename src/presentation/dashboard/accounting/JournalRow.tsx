import { getLocale, getTranslations } from "next-intl/server";

import type { Account, JournalEntry } from "@/src/domain/entities/Ledger";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { accountName, entryTotal } from "./accounting-format";
import { JournalRowActions } from "./JournalRowActions";

/**
 * Column tracks for the journal on a wide frame — the entry, its date, what
 * posted it, the amount and the "⋯". Shared by the heading row and every entry so
 * they line up.
 */
export const JOURNAL_COLUMNS = "@4xl/journal:grid-cols-[minmax(0,1fr)_6rem_7rem_9rem_2.5rem]";

type JournalRowProps = {
  entry: JournalEntry;
  /** The chart of accounts by code, to name the accounts each side touches. */
  accounts: ReadonlyMap<string, Account>;
  /** Offers "Reverse entry" on an entry that can be reversed. */
  reversible: boolean;
  /** Today on the cafe calendar — the day a reversal is booked. */
  today: string;
};

/**
 * One journal entry: what it was for (opening the entry) and whether it's been
 * reversed, its number and the accounts debited and credited, then its date,
 * what posted it and its size. A row on a wide frame; on a narrow one the figures
 * wrap under the description, each labelled.
 */
export async function JournalRow({ entry, accounts, reversible, today }: JournalRowProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  const side = (pick: "debit" | "credit"): string =>
    entry.lines
      .filter((line) => line[pick] > 0)
      .map((line) => {
        const account = accounts.get(line.accountCode);
        return account ? accountName(account, locale) : line.accountCode;
      })
      .join(locale === "fa" ? "، " : ", ");

  const figure = "flex min-w-0 flex-col gap-0.5 text-start";
  const inlineLabel = "text-body-small text-muted-foreground sm:text-body-caption @4xl/journal:hidden";
  const value = "text-body-default sm:text-body-small";

  return (
    <article
      aria-label={t("entry.title", { number: entry.number })}
      className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3", JOURNAL_COLUMNS)}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/dashboard/accounting/journal/${entry.id}`}
            dir="auto"
            className={cn(
              "text-body-strong [overflow-wrap:anywhere] text-foreground transition-colors hover:text-primary sm:text-body-small-strong",
              focusRing,
            )}
          >
            {entry.description}
          </Link>
          {entry.reversedById ? (
            <Badge size="compact" variant="neutral" appearance="outline">
              {t("journal.reversed")}
            </Badge>
          ) : null}
        </div>
        <span className="text-body-small text-muted-foreground tabular-nums sm:text-body-caption">
          {t("journal.lines", { number: entry.number, debits: side("debit"), credits: side("credit") })}
        </span>
      </div>

      {/* The figures: their own wrapped line under the entry on a narrow frame,
          columns of the row's grid on a wide one. */}
      <div className="order-1 col-span-full flex flex-wrap gap-x-8 gap-y-2 @4xl/journal:contents">
        <div className={figure}>
          <span className={inlineLabel}>{t("journal.colDate")}</span>
          <span className={cn(value, "whitespace-nowrap text-foreground/80 tabular-nums")}>
            {formatCafeDayShort(entry.date, locale)}
          </span>
        </div>
        <div className={figure}>
          <span className={inlineLabel}>{t("journal.colSource")}</span>
          <span className={cn(value, "text-foreground/80")}>{t(`source.${entry.source}`)}</span>
        </div>
        <div className={cn(figure, "@4xl/journal:text-end")}>
          <span className={inlineLabel}>{t("journal.colAmount")}</span>
          <span className={cn(value, "font-semibold whitespace-nowrap text-foreground tabular-nums")}>
            {formatNumber(entryTotal(entry), locale)}
          </span>
        </div>
      </div>

      <div className="flex justify-end @4xl/journal:order-1">
        {reversible ? <JournalRowActions entryId={entry.id} number={entry.number} today={today} /> : null}
      </div>
    </article>
  );
}

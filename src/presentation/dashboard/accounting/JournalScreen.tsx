import { getTranslations } from "next-intl/server";

import { isReversibleSource, JOURNAL_SOURCES, type Account, type JournalEntry } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { cn } from "@/src/lib/utils";
import { ListChoiceFilter, ListPager } from "@/src/presentation/dashboard/list";

import { DashboardEmptyState } from "../DashboardEmptyState";

import { AccountingHeader } from "./AccountingHeader";
import { JOURNAL_COLUMNS, JournalRow } from "./JournalRow";

type JournalScreenProps = {
  page: Page<JournalEntry>;
  /** The chart of accounts, naming each entry's sides. */
  accounts: Account[];
  /** A "Posted by" filter is applied — to tell "nothing posted" from "nothing by this". */
  filtered: boolean;
  canWrite: boolean;
  /** Today on the cafe calendar — the day a manual entry or a reversal is booked. */
  today: string;
};

/**
 * Every entry in the books, newest first, filterable by what posted it. A
 * reversible entry carries "Reverse entry" behind its "⋯"; nothing is ever edited
 * or deleted. Presentational — the page reads the journal over the REST API (BFF).
 */
export async function JournalScreen({ page, accounts, filtered, canWrite, today }: JournalScreenProps) {
  const t = await getTranslations("dashAccounting");
  const byCode = new Map(accounts.map((account) => [account.code, account]));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingHeader active="journal" intro={t("journal.subtitle")} writer={canWrite ? { accounts, today } : null} />

      <section
        aria-label={t("journal.heading")}
        className="@container/journal min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
          <ListChoiceFilter
            paramName="source"
            label={t("journal.filterSource")}
            allLabel={t("journal.allSources")}
            showAllValue
            options={JOURNAL_SOURCES.map((source) => ({ value: source, label: t(`source.${source}`) }))}
          />
        </div>

        {page.items.length > 0 ? (
          <>
            <div
              aria-hidden
              className={cn(
                "hidden h-10 items-center gap-x-4 border-b border-border bg-muted px-5 text-body-caption font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase @4xl/journal:grid",
                JOURNAL_COLUMNS,
              )}
            >
              <span>{t("journal.colEntry")}</span>
              <span>{t("journal.colDate")}</span>
              <span>{t("journal.colSource")}</span>
              <span className="text-end">{t("journal.colAmount")}</span>
              <span />
            </div>
            <ul>
              {page.items.map((entry, index) => (
                <li key={entry.id} className={cn(index > 0 && "border-t border-border")}>
                  <JournalRow
                    entry={entry}
                    accounts={byCode}
                    reversible={canWrite && isReversibleSource(entry.source) && !entry.reversedById}
                    today={today}
                  />
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <ListPager page={page} />
            </div>
          </>
        ) : (
          <DashboardEmptyState
            title={t("journal.emptyTitle")}
            body={filtered ? t("journal.emptyFiltered") : t("journal.emptyBody")}
          />
        )}
      </section>
    </div>
  );
}

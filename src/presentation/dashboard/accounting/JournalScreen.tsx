import { getLocale, getTranslations } from "next-intl/server";

import { JOURNAL_SOURCES, type JournalEntry } from "@/src/domain/entities/Ledger";
import type { Page } from "@/src/domain/entities/Pagination";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { ListFilterSelect, ListPager } from "@/src/presentation/dashboard/list";
import { Badge, Button } from "@/src/presentation/design-system";

import { entryTotal } from "./accounting-format";
import { AccountingTabs } from "./AccountingTabs";
import { PeriodPicker } from "./PeriodPicker";

type JournalScreenProps = {
  page: Page<JournalEntry>;
  fromDay: string;
  toDay: string;
  /** The other active filters, kept when the period changes. */
  keep: Record<string, string>;
  canWrite: boolean;
};

/** Every entry in the books for a period, newest first, filterable by what posted it. */
export async function JournalScreen({ page, fromDay, toDay, keep, canWrite }: JournalScreenProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <AccountingTabs active="journal" title={t("journal.heading")} subtitle={t("journal.subtitle")} />

      <div className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:flex-row md:items-start md:justify-between md:p-6">
        <PeriodPicker fromDay={fromDay} toDay={toDay} keep={keep} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-body-caption text-muted-foreground">
            {t("journal.filterSource")}
            <ListFilterSelect
              className="h-9 min-w-44"
              paramName="source"
              label={t("journal.filterSource")}
              options={[{ value: "", label: t("journal.allSources") }, ...JOURNAL_SOURCES.map((source) => ({ value: source, label: t(`source.${source}`) }))]}
            />
          </label>
          {canWrite ? (
            <Button asChild size="sm">
              <Link href="/dashboard/accounting/journal/new">{t("journal.newEntry")}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
        {page.items.length === 0 ? (
          <p className="px-6 py-16 text-center text-body-small-emphasis text-muted-foreground">{t("journal.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-body-small">
              <thead className="bg-surface text-start text-body-caption text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colNumber")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colDate")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colDescription")}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{t("journal.colSource")}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium">{t("journal.colAmount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {page.items.map((entry) => (
                  <tr key={entry.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/accounting/journal/${entry.id}`} className="text-body-small-emphasis text-primary underline-offset-4 hover:underline">
                        JE-{entry.number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatCafeDayMedium(entry.date, locale)}</td>
                    <td className="px-4 py-3 text-foreground">
                      <span dir="auto">{entry.description}</span>
                      {entry.reversedById ? (
                        <Badge size="sm" variant="warning" className="ms-2">
                          {t("journal.reversed")}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge size="sm" variant={entry.source === "manual" ? "info" : "neutral"}>
                        {t(`source.${entry.source}`)}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end text-body-small-emphasis text-foreground">{formatMoney(entryTotal(entry), locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-border px-4 py-3">
          <ListPager page={page} />
        </div>
      </section>
    </div>
  );
}

import { getLocale } from "next-intl/server";

import type { StatementSection } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";

import { accountName } from "./accounting-format";

type StatementSectionTableProps = {
  heading: string;
  section: StatementSection;
  totalLabel: string;
  /** Message when the section has no movement. */
  empty: string;
  /** Extra rows after the accounts (e.g. current earnings in equity). */
  extra?: { label: string; amount: number }[];
  /** Overrides the section total (when extra rows add to it). */
  total?: number;
};

/** One block of a statement: its accounts with balances, then the total. */
export async function StatementSectionTable({
  heading,
  section,
  totalLabel,
  empty,
  extra = [],
  total,
}: StatementSectionTableProps) {
  const locale = await getLocale();

  return (
    <section className="min-w-0 overflow-hidden rounded-card-lg border border-border bg-background">
      <h2 className="border-b border-border bg-surface px-4 py-3 text-body-small-emphasis text-foreground">
        {heading}
      </h2>
      <ul className="divide-y divide-border text-body-small">
        {section.rows.length === 0 && extra.length === 0 ? (
          <li className="px-4 py-4 text-muted-foreground">{empty}</li>
        ) : null}
        {section.rows.map((row) => (
          <li key={row.account.code} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-12 shrink-0 font-mono text-muted-foreground" dir="ltr">
              {row.account.code}
            </span>
            <Link
              href={`/dashboard/accounting/accounts/${row.account.code}`}
              className="min-w-0 flex-1 truncate text-foreground underline-offset-4 hover:underline"
            >
              {accountName(row.account, locale)}
            </Link>
            <span
              className={
                row.balance < 0 ? "whitespace-nowrap text-error-foreground" : "whitespace-nowrap text-foreground"
              }
            >
              {formatMoney(row.balance, locale)}
            </span>
          </li>
        ))}
        {extra.map((row) => (
          <li key={row.label} className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-12 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground italic">{row.label}</span>
            <span
              className={
                row.amount < 0 ? "whitespace-nowrap text-error-foreground" : "whitespace-nowrap text-foreground"
              }
            >
              {formatMoney(row.amount, locale)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 text-body-small-emphasis text-foreground">
        <span>{totalLabel}</span>
        <span className="whitespace-nowrap">{formatMoney(total ?? section.total, locale)}</span>
      </div>
    </section>
  );
}

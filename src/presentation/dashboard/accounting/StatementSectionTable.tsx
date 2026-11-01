import { getLocale } from "next-intl/server";

import type { StatementSection } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { AMOUNT, GROUP_BAND, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { accountName } from "./accounting-format";

/** A row of a statement: the account, then its figure at the inline-end. */
const ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-3";

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
    <section aria-label={heading} className={cn(PAGE_CARD, ROW_TEXT, "overflow-hidden")}>
      <h2 className={GROUP_BAND}>{heading}</h2>
      {section.rows.length === 0 && extra.length === 0 ? (
        <p className="px-5 py-3 text-muted-foreground">{empty}</p>
      ) : null}
      <ul className="divide-y divide-border">
        {section.rows.map((row) => (
          <li key={row.account.code} className={ROW}>
            <Link
              href={`/dashboard/accounting/accounts/${row.account.code}`}
              className="min-w-0 text-foreground transition-colors hover:text-primary"
            >
              <span className={cn(ROW_CAPTION, "me-2 tabular-nums")}>{row.account.code}</span>
              {accountName(row.account, locale)}
            </Link>
            <span className={cn(AMOUNT, row.balance < 0 ? "text-error-foreground" : "text-foreground")}>
              {formatNumber(row.balance, locale)}
            </span>
          </li>
        ))}
        {extra.map((row) => (
          <li key={row.label} className={ROW}>
            <span className="min-w-0 text-foreground">{row.label}</span>
            <span className={cn(AMOUNT, row.amount < 0 ? "text-error-foreground" : "text-foreground")}>
              {formatNumber(row.amount, locale)}
            </span>
          </li>
        ))}
      </ul>
      <div className={cn(ROW, "border-t border-border font-semibold text-foreground")}>
        <span>{totalLabel}</span>
        <span className={AMOUNT}>{formatNumber(total ?? section.total, locale)}</span>
      </div>
    </section>
  );
}

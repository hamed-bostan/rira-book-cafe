import { CircleAlert, CircleCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankStatement, ReconciliationSummary } from "@/src/domain/entities/BankReconciliation";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";

import { ReconcileButton } from "./ReconcileButton";

type ReconciliationSummaryPanelProps = { statement: BankStatement; summary: ReconciliationSummary; canWrite: boolean };

/**
 * The proof, as an accountant writes it: the book balance at the period end, less
 * what the bank hasn't seen yet, plus what it cleared that the books date later,
 * against the statement's closing balance. Also whether the lines entered take the
 * opening balance to the closing one.
 */
export async function ReconciliationSummaryPanel({ statement, summary, canWrite }: ReconciliationSummaryPanelProps) {
  const t = await getTranslations("dashBank");
  const locale = await getLocale();
  const reconciled = statement.status === "reconciled";

  const rows: { key: string; label: string; value: number; strong?: boolean }[] = [
    { key: "book", label: t("summary.bookBalance", { date: formatCafeDayMedium(statement.toDay, locale) }), value: summary.bookBalance },
    { key: "outstanding", label: t("summary.outstanding", { count: summary.outstandingCount }), value: -summary.outstanding },
    { key: "clearedAfter", label: t("summary.clearedAfter"), value: summary.clearedAfter },
    { key: "adjusted", label: t("summary.adjustedBook"), value: summary.adjustedBook, strong: true },
    { key: "closing", label: t("summary.closingBalance"), value: statement.closingBalance, strong: true },
  ];

  return (
    <section className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6">
      <h2 className="text-body-lead text-foreground">{t("summary.heading")}</h2>
      <dl className="flex flex-col divide-y divide-border text-body-small">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 py-2">
            <dt className={row.strong ? "text-body-small-emphasis text-foreground" : "text-muted-foreground"}>{row.label}</dt>
            <dd className={row.strong ? "text-body-strong text-foreground" : "text-foreground"}>{formatMoney(row.value, locale)}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 py-2">
          <dt className="text-body-small-emphasis text-foreground">{t("summary.difference")}</dt>
          <dd className={cn("text-body-strong", summary.difference === 0 ? "text-success-foreground" : "text-error-foreground")}>{formatMoney(summary.difference, locale)}</dd>
        </div>
      </dl>

      <ul className="flex flex-col gap-1.5 text-body-small">
        <li className={cn("flex items-center gap-2", summary.statementGap === 0 ? "text-success-foreground" : "text-warning-foreground")}>
          {summary.statementGap === 0 ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
          {summary.statementGap === 0 ? t("summary.linesAddUp") : t("summary.linesGap", { amount: formatMoney(summary.statementGap, locale) })}
        </li>
        <li className={cn("flex items-center gap-2", summary.unmatchedLines === 0 ? "text-success-foreground" : "text-warning-foreground")}>
          {summary.unmatchedLines === 0 ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
          {summary.unmatchedLines === 0 ? t("summary.allMatched") : t("summary.unmatched", { count: summary.unmatchedLines })}
        </li>
      </ul>

      {reconciled ? (
        <p className="flex items-center gap-2 text-body-small text-success-foreground">
          <CircleCheck className="size-4 shrink-0" aria-hidden />
          {t("summary.reconciledBy", {
            by: statement.reconciledByName ?? "",
            date: statement.reconciledAt ? formatCafeDayMedium(cafeDayOf(new Date(statement.reconciledAt)), locale) : "",
          })}
        </p>
      ) : canWrite ? (
        <ReconcileButton statementId={statement.id} ready={summary.canReconcile} />
      ) : null}
    </section>
  );
}

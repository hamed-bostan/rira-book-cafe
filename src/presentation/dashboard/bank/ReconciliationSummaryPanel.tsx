import { CircleAlert, CircleCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BankStatement, ReconciliationSummary } from "@/src/domain/entities/BankReconciliation";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DashboardSection } from "../DashboardSection";
import { AMOUNT } from "../pageStyles";

import { ReconcileButton } from "./ReconcileButton";

/** A line of the proof: what it is, then the figure at the inline-end. */
const PROOF_ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2";

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
    {
      key: "book",
      label: t("summary.bookBalance", { date: formatCafeDayMedium(statement.toDay, locale) }),
      value: summary.bookBalance,
    },
    {
      key: "outstanding",
      label: t("summary.outstanding", { count: summary.outstandingCount }),
      value: -summary.outstanding,
    },
    { key: "clearedAfter", label: t("summary.clearedAfter"), value: summary.clearedAfter },
    { key: "adjusted", label: t("summary.adjustedBook"), value: summary.adjustedBook, strong: true },
    { key: "closing", label: t("summary.closingBalance"), value: statement.closingBalance },
  ];

  const checks = [
    {
      ok: summary.statementGap === 0,
      text:
        summary.statementGap === 0
          ? t("summary.linesAddUp")
          : t("summary.linesGap", { amount: formatNumber(summary.statementGap, locale) }),
    },
    {
      ok: summary.unmatchedLines === 0,
      text:
        summary.unmatchedLines === 0
          ? t("summary.allMatched")
          : t("summary.unmatched", { count: summary.unmatchedLines }),
    },
  ];

  return (
    <DashboardSection title={t("summary.heading")} className="xl:sticky xl:top-20" flush>
      <div className="flex flex-col gap-3 px-5 pt-4 pb-5">
        <dl className="flex flex-col">
          {rows.map((row) => (
            <div key={row.key} className={cn(PROOF_ROW, row.strong && "border-t border-border font-semibold")}>
              <dt className={row.strong ? "text-foreground" : "text-foreground/80"}>{row.label}</dt>
              <dd className={cn(AMOUNT, "text-foreground")}>{formatNumber(row.value, locale)}</dd>
            </div>
          ))}
          <div className={cn(PROOF_ROW, "border-t border-border")}>
            <dt className="font-semibold text-foreground">{t("summary.difference")}</dt>
            <dd
              className={cn(
                AMOUNT,
                "font-bold",
                summary.difference === 0 ? "text-success-foreground" : "text-error-foreground",
              )}
            >
              {formatNumber(summary.difference, locale)}
            </dd>
          </div>
        </dl>

        <ul className="flex flex-col gap-2">
          {checks.map((check) => (
            <li
              key={check.text}
              className={cn(
                "flex items-start gap-2 font-medium",
                check.ok ? "text-success-foreground" : "text-warning-foreground",
              )}
            >
              <Icon icon={check.ok ? CircleCheck : CircleAlert} size="icon-md" className="mt-0.5" />
              <span>{check.text}</span>
            </li>
          ))}
        </ul>

        {reconciled ? (
          <p className="flex items-center gap-2 font-medium text-success-foreground">
            <Icon icon={CircleCheck} size="icon-md" />
            <span>
              {t("summary.reconciledBy", {
                by: statement.reconciledByName ?? "",
                date: statement.reconciledAt
                  ? formatCafeDayMedium(cafeDayOf(new Date(statement.reconciledAt)), locale)
                  : "",
              })}
            </span>
          </p>
        ) : canWrite ? (
          <ReconcileButton statementId={statement.id} ready={summary.canReconcile} />
        ) : null}
      </div>
    </DashboardSection>
  );
}

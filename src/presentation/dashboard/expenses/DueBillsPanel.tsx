import { getLocale, getTranslations } from "next-intl/server";

import type { DueBill } from "@/src/domain/entities/RecurringBill";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { DashboardSection } from "../DashboardSection";
import { AMOUNT, ROW_CAPTION, ROW_END } from "../pageStyles";

import { DueBillActions } from "./DueBillActions";

/** Months of recurring bills waiting for someone: nothing reaches the books until a person records it here. */
export async function DueBillsPanel({ dueBills }: { dueBills: DueBill[] }) {
  const t = await getTranslations("dashExpenses.recurring");
  const locale = await getLocale();

  return (
    <DashboardSection
      title={t("dueHeading")}
      aside={t("dueCount", { count: dueBills.length, formatted: formatNumber(dueBills.length, locale) })}
      flush
    >
      <ul className="divide-y divide-border">
        {dueBills.map((due) => {
          const date = formatCafeDayMedium(due.dueOn, locale);
          return (
            <li key={`${due.bill.id}:${due.period}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                <span className="font-semibold text-foreground" dir="auto">
                  {due.bill.description}
                </span>
                <span className={ROW_CAPTION}>
                  {t("dueOn", { date })}
                  {due.bill.supplierName ? ` · ${due.bill.supplierName}` : ""}
                </span>
              </span>
              <span className={ROW_END}>
                <span className={cn(AMOUNT, "font-semibold text-foreground")}>
                  {formatMoney(due.bill.amount, locale)}
                </span>
                <DueBillActions due={due} date={date} />
              </span>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}

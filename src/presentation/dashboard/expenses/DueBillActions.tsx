"use client";

import { useTranslations } from "next-intl";

import type { DueBill } from "@/src/domain/entities/RecurringBill";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { useExpenseDialogs } from "./ExpenseDialogsProvider";

/** What can be done with a month of a bill: check it and record it, or skip it. */
export function DueBillActions({ due, date }: { due: DueBill; date: string }) {
  const t = useTranslations("dashExpenses.recurring");
  const { openRecord, openSkip } = useExpenseDialogs();
  const name = due.bill.description;

  return (
    <span className="flex gap-2">
      <Button
        type="button"
        variant="secondary"
        size="control-sm"
        className="px-3"
        aria-label={t("skipLabel", { name, date })}
        onClick={() => openSkip(due)}
      >
        {t("skip")}
      </Button>
      <Button
        type="button"
        size="control-sm"
        className="px-3"
        aria-label={t("recordLabel", { name, date })}
        onClick={() => openRecord(due)}
      >
        {t("record")}
      </Button>
    </span>
  );
}

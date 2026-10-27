"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useExpenseDialogs } from "./ExpenseDialogsProvider";

/** The page's primary action: opens "Record an expense". */
export function RecordExpenseButton() {
  const t = useTranslations("dashExpenses");
  const { openRecord } = useExpenseDialogs();

  return (
    <Button size="control-md" type="button" className="gap-2 px-4" onClick={openRecord}>
      <Icon icon={Plus} size="sm" strokeWidth={2} />
      {t("new")}
    </Button>
  );
}

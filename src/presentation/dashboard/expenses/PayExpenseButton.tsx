"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { PayExpenseDialog, type PayableExpense } from "./PayExpenseDialog";

type PayExpenseButtonProps = { expense: PayableExpense; today: string };

/** Pay an owed expense from its own page — the same dialog as the list's "⋯ → Pay". */
export function PayExpenseButton({ expense, today }: PayExpenseButtonProps) {
  const t = useTranslations("dashExpenses");
  const [open, setOpen] = React.useState(false);
  /** A fresh form each time it opens. */
  const [key, setKey] = React.useState(0);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setKey((current) => current + 1);
          setOpen(true);
        }}
      >
        {t("detail.pay")}
      </Button>
      <PayExpenseDialog key={key} open={open} onOpenChange={setOpen} expense={expense} today={today} />
    </>
  );
}

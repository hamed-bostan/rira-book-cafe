"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { PayPayRunDialog } from "./PayPayRunDialog";
import { VoidPayRunDialog } from "./VoidPayRunDialog";

type PayRunActionsProps = {
  id: string;
  month: string;
  /** The day it was booked: the earliest it can be paid. */
  date: string;
  /** What's still owed to the staff. */
  owed: number;
  today: string;
};

/** Pay what's left, or void the run. Each opening starts a fresh form. */
export function PayRunActions({ id, month, date, owed, today }: PayRunActionsProps) {
  const t = useTranslations("dashPayroll");
  const [dialog, setDialog] = React.useState<{ kind: "pay" | "void"; open: boolean; key: number } | null>(null);
  const open = (kind: "pay" | "void"): void =>
    setDialog((current) => ({ kind, open: true, key: (current?.key ?? 0) + 1 }));
  const onOpenChange = (next: boolean): void => setDialog((current) => (current ? { ...current, open: next } : null));

  return (
    <>
      <Button type="button" variant="secondary" size="control-md" className="px-3" onClick={() => open("void")}>
        {t("detail.void")}
      </Button>
      {owed > 0 ? (
        <Button type="button" size="control-md" className="px-4" onClick={() => open("pay")}>
          {t("detail.pay")}
        </Button>
      ) : null}
      {dialog?.kind === "pay" ? (
        <PayPayRunDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={onOpenChange}
          id={id}
          month={month}
          date={date}
          owed={owed}
          today={today}
        />
      ) : dialog?.kind === "void" ? (
        <VoidPayRunDialog key={dialog.key} open={dialog.open} onOpenChange={onOpenChange} id={id} month={month} />
      ) : null}
    </>
  );
}

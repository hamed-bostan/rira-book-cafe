"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { RecordIncomeDialog, type IncomePreset } from "./RecordIncomeDialog";

type TakePaymentButtonProps = {
  preset: IncomePreset;
  today: string;
  vatRateBps: number;
};

/** "Take payment" on something the cafe charges for outside an order: an event seat, a suite stay. */
export function TakePaymentButton({ preset, today, vatRateBps }: TakePaymentButtonProps) {
  const t = useTranslations("dashIncome");
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(0);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-sm"
        className="px-3"
        onClick={() => {
          setOpened(opened + 1);
          setOpen(true);
        }}
      >
        {t("takePayment")}
      </Button>
      <RecordIncomeDialog
        key={opened}
        open={open}
        onOpenChange={setOpen}
        accounts={[]}
        today={today}
        vatRateBps={vatRateBps}
        preset={preset}
      />
    </>
  );
}

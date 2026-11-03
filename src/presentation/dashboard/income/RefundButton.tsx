"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { RefundDialog, type RefundableBooking } from "./RefundDialog";

/** "Refund" on a suite stay or an event sign-up with money paid and not yet handed back. */
export function RefundButton(props: RefundableBooking) {
  const t = useTranslations("dashIncome");
  const [open, setOpen] = React.useState(false);
  // A fresh dialog each time, so it starts from what's left now.
  const [opened, setOpened] = React.useState(0);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-sm"
        className="px-3"
        aria-label={t("refund.buttonAria", { name: props.guestName })}
        onClick={() => {
          setOpened(opened + 1);
          setOpen(true);
        }}
      >
        {t("refund.button")}
      </Button>
      <RefundDialog key={opened} open={open} onOpenChange={setOpen} {...props} />
    </>
  );
}

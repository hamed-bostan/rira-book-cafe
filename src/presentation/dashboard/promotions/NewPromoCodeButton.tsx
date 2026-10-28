"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { PromoCodeDialog } from "./PromoCodeDialog";

type NewPromoCodeButtonProps = {
  takenCodes: readonly string[];
  /** Today on the cafe calendar. */
  today: string;
};

/** The page's "New code" button and the dialog it opens. */
export function NewPromoCodeButton({ takenCodes, today }: NewPromoCodeButtonProps) {
  const t = useTranslations("dashPromotions");
  const [open, setOpen] = React.useState(false);
  // Bumped on every open, so the dialog starts empty — nothing left from last time.
  const [opened, setOpened] = React.useState(0);

  return (
    <>
      <Button
        size="control-md"
        type="button"
        className="gap-2 px-4"
        onClick={() => {
          setOpened((count) => count + 1);
          setOpen(true);
        }}
      >
        <Icon icon={Plus} size="icon-md" />
        {t("newCode")}
      </Button>
      <PromoCodeDialog key={opened} open={open} onOpenChange={setOpen} takenCodes={takenCodes} today={today} />
    </>
  );
}

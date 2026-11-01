"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { Account } from "@/src/domain/entities/Ledger";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { RecordIncomeDialog } from "./RecordIncomeDialog";

type RecordIncomeButtonProps = {
  accounts: readonly Account[];
  today: string;
  vatRateBps: number;
};

/** The Income page's primary action. Keyed by each opening, so a new entry starts clean. */
export function RecordIncomeButton({ accounts, today, vatRateBps }: RecordIncomeButtonProps) {
  const t = useTranslations("dashIncome");
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(0);

  return (
    <>
      <Button
        size="control-md"
        type="button"
        className="gap-2 px-4"
        onClick={() => {
          setOpened(opened + 1);
          setOpen(true);
        }}
      >
        <Icon icon={Plus} size="sm" strokeWidth={2} />
        {t("new")}
      </Button>
      <RecordIncomeDialog
        key={opened}
        open={open}
        onOpenChange={setOpen}
        accounts={accounts}
        today={today}
        vatRateBps={vatRateBps}
      />
    </>
  );
}

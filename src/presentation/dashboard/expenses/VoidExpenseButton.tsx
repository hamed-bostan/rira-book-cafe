"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { VoidExpenseDialog } from "./VoidExpenseDialog";

/** Void an expense from its own page — the same dialog as the list's "⋯ → Void". */
export function VoidExpenseButton({ id, number }: { id: string; number: number }) {
  const t = useTranslations("dashExpenses");
  const [open, setOpen] = React.useState(false);
  /** A fresh form each time it opens. */
  const [key, setKey] = React.useState(0);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive"
        onClick={() => {
          setKey((current) => current + 1);
          setOpen(true);
        }}
      >
        {t("detail.void")}
      </Button>
      <VoidExpenseDialog key={key} open={open} onOpenChange={setOpen} expense={{ id, number }} />
    </>
  );
}

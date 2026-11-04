"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { CafeTableDialog } from "./CafeTableDialog";

/** "Add table": opens the table dialog, fresh each time, for a table at the end of the floor. */
export function AddCafeTableButton({ disabled = false }: { disabled?: boolean }) {
  const t = useTranslations("dashSettings.tables");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="w-fit gap-2 px-3"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Icon icon={Plus} size="icon-md" />
        {t("addButton")}
      </Button>
      {open ? <CafeTableDialog open onOpenChange={setOpen} /> : null}
    </>
  );
}

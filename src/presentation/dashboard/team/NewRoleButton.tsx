"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { RoleEditorDialog } from "./RoleEditorDialog";

/** "New role", and the editor it opens — fresh every time. */
export function NewRoleButton() {
  const t = useTranslations("dashTeam");
  const [open, setOpen] = React.useState(false);
  const [opened, setOpened] = React.useState(0);

  return (
    <>
      <Button
        size="control-md"
        className="px-3"
        onClick={() => {
          setOpened((count) => count + 1);
          setOpen(true);
        }}
      >
        <Icon icon={Plus} size="sm" />
        {t("roles.new")}
      </Button>
      <RoleEditorDialog key={opened} open={open} onOpenChange={setOpen} editing={null} />
    </>
  );
}

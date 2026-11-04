"use client";

import { ChevronDown, ChevronUp, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { CafeTable, CafeTableMoveDirection } from "@/src/domain/entities/CafeTable";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { cafeTablesApi } from "./cafe-table-api";
import { CafeTableDialog } from "./CafeTableDialog";
import { DeleteCafeTableDialog } from "./DeleteCafeTableDialog";

type CafeTableRowActionsProps = {
  table: CafeTable;
  /** The table's name as staff read it ("Table 7"). */
  name: string;
  isFirst: boolean;
  isLast: boolean;
};

/**
 * A table's controls: move it along the floor order, and behind "⋯" Edit, Take
 * out of use (or Put back in use) and Delete. Each writes over the REST API, then
 * `router.refresh()`es so the list comes back from the server.
 */
export function CafeTableRowActions({ table, name, isFirst, isLast }: CafeTableRowActionsProps) {
  const t = useTranslations("dashSettings.tables");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  function move(direction: CafeTableMoveDirection): void {
    startTransition(async () => {
      try {
        await cafeTablesApi.move(table.id, direction);
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("moveError")) });
      }
      router.refresh();
    });
  }

  function setInUse(isActive: boolean, undoable = true): void {
    startTransition(async () => {
      try {
        await cafeTablesApi.update(table.id, {
          label: table.label,
          seats: String(table.seats),
          area: table.area ?? "",
          isActive,
        });
        toast({
          tone: "success",
          title: isActive ? t("activatedToast", { name }) : t("deactivatedToast", { name }),
          onUndo: undoable ? () => setInUse(!isActive, false) : undefined,
        });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("saveError")) });
      }
      router.refresh();
    });
  }

  return (
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <Button
        size="control-md"
        type="button"
        variant="secondary"
        iconOnly
        aria-label={t("moveUp", { name })}
        disabled={isFirst || pending}
        onClick={() => move("up")}
      >
        <Icon icon={ChevronUp} size="sm" className="sm:size-4" />
      </Button>
      <Button
        size="control-md"
        type="button"
        variant="secondary"
        iconOnly
        aria-label={t("moveDown", { name })}
        disabled={isLast || pending}
        onClick={() => move("down")}
      >
        <Icon icon={ChevronDown} size="sm" className="sm:size-4" />
      </Button>
      <DropdownMenu>
        <DropdownMenuIconTrigger disabled={pending} aria-label={t("actionsAria", { name })} appearance="secondary">
          <Icon icon={MoreHorizontal} size="sm" className="sm:size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>{t("edit")}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setInUse(!table.isActive)}>
            {table.isActive ? t("deactivate") : t("activate")}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDeleting(true)}>
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? <CafeTableDialog open onOpenChange={setEditing} table={table} /> : null}
      <DeleteCafeTableDialog
        table={table}
        name={name}
        open={deleting}
        onOpenChange={setDeleting}
        onDeactivate={() => setInUse(false)}
      />
    </div>
  );
}

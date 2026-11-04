"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { CafeTable } from "@/src/domain/entities/CafeTable";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { TEXT_ACTION } from "../fieldStyles";

import { cafeTablesApi } from "./cafe-table-api";

type DeleteCafeTableDialogProps = {
  table: Pick<CafeTable, "id" | "label" | "isActive">;
  /** The table's name as staff read it ("Table 7"). */
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Take the table out of use instead — offered when something still needs it. */
  onDeactivate: () => void;
};

/**
 * Confirms removing a table for good. A table an open order is at, or that a
 * booking or event still holds ahead, can't go (the API answers 409 `IN_USE`): the
 * dialog then says so and offers to take it out of use instead, which keeps it
 * off the pickers without losing what's on it.
 */
export function DeleteCafeTableDialog({ table, name, open, onOpenChange, onDeactivate }: DeleteCafeTableDialogProps) {
  const t = useTranslations("dashSettings.tables");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [inUse, setInUse] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function remove(): void {
    setError(null);
    startTransition(async () => {
      try {
        await cafeTablesApi.remove(table.id);
        toast({ tone: "success", title: t("deletedToast", { name }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        if (err instanceof ApiError && err.code === "IN_USE") setInUse(true);
        else setError(localizeApiError(err, tApiErrors, t("deleteError")));
      }
    });
  }

  function handleOpenChange(next: boolean): void {
    onOpenChange(next);
    if (!next) {
      setError(null);
      setInUse(false);
    }
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("deleteTitle", { name })}
      subtitle={t("deleteSubtitle")}
      submitLabel={t("deleteConfirm")}
      blocked={inUse}
      pending={pending}
      onSubmit={remove}
      error={inUse ? t("deleteInUse", { name }) : error}
      danger
      aside={
        inUse && table.isActive ? (
          <p className="text-body-small text-muted-foreground sm:text-body-caption">
            <button
              type="button"
              onClick={() => {
                handleOpenChange(false);
                onDeactivate();
              }}
              className={cn(
                TEXT_ACTION,
                "text-primary underline underline-offset-4 hover:text-primary-hover",
                focusRing,
              )}
            >
              {t("deactivateInstead")}
            </button>
          </p>
        ) : null
      }
    />
  );
}

"use client";

import { MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { PromoCode } from "@/src/domain/entities/Promotion";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { PromoActiveSwitch } from "./PromoActiveSwitch";
import { PromoCodeDialog } from "./PromoCodeDialog";
import { promotionsApi } from "./promotion-api";

type PromoCodeRowActionsProps = {
  promo: PromoCode;
  /**
   * Ended or used up: the switch can't bring it back, so it isn't drawn, and
   * Edit reads "Edit to run again".
   */
  finished: boolean;
  takenCodes: readonly string[];
  /** Today on the cafe calendar. */
  today: string;
};

/**
 * A code's controls: its on/off switch, and behind "⋯" Edit (in a dialog) and
 * Delete (which asks first). Each writes over the REST API and `router.refresh()`es.
 */
export function PromoCodeRowActions({ promo, finished, takenCodes, today }: PromoCodeRowActionsProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  // Bumped on every Edit, so the dialog starts from the code as saved.
  const [opened, setOpened] = React.useState(0);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();

  function remove(): void {
    setDeleteError(null);
    startDelete(async () => {
      try {
        await promotionsApi.removePromoCode(promo.id);
        toast({ tone: "success", title: t("deleted", { code: promo.code }) });
        setConfirmDelete(false);
      } catch (err) {
        setDeleteError(localizeApiError(err, tApiErrors, t("deleteError")));
      }
      router.refresh();
    });
  }

  return (
    <div className="ms-auto flex shrink-0 items-center gap-4">
      {finished ? null : <PromoActiveSwitch id={promo.id} code={promo.code} isActive={promo.isActive} />}
      <DropdownMenu>
        <DropdownMenuIconTrigger
          appearance="secondary"
          disabled={deleting}
          aria-label={t("moreActionsAria", { code: promo.code })}
        >
          <Icon icon={MoreHorizontal} size="icon-md" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setOpened((count) => count + 1);
              setEditing(true);
            }}
          >
            {finished ? t("editAgain") : t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            destructive
            onSelect={() => {
              setDeleteError(null);
              setConfirmDelete(true);
            }}
          >
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PromoCodeDialog
        key={opened}
        open={editing}
        onOpenChange={setEditing}
        promo={promo}
        takenCodes={takenCodes}
        today={today}
      />
      <DashboardDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("deleteTitle", { code: promo.code })}
        subtitle={t("deleteBody")}
        submitLabel={t("delete")}
        pending={deleting}
        onSubmit={remove}
        error={deleteError}
        danger
      />
    </div>
  );
}

"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, Icon } from "@/src/presentation/design-system";

import { teamApi } from "./team-api";

type RevokeAdminButtonProps = {
  id: string;
  name: string;
};

/**
 * Withdraw a member's admin access, confirming via the DS ConfirmSheet first.
 *
 * The rows the server would refuse — yourself, the last admin, an env break-glass
 * admin — don't render this button at all (see `TeamTable`); the API still
 * enforces each rule, and a refusal surfaces in the sheet.
 */
export function RevokeAdminButton({ id, name }: RevokeAdminButtonProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.revoke(id);
        setOpen(false);
        // Re-run the server render so the table reflects the change — the server
        // stays the source of truth instead of patching local state.
        router.refresh();
      } catch (err) {
        // Re-open the sheet in a failure state so the error reads in context and
        // the user can retry — instead of a disruptive window.alert.
        setError(localizeApiError(err, tApiErrors, t("revokeError")));
        setOpen(true);
      }
    });
  }

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) setError(null); // Drop a stale error once the sheet is dismissed.
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        iconOnly
        aria-label={t("revokeAria", { name })}
        onClick={() => setOpen(true)}
        disabled={pending}
        className="size-11 text-destructive sm:size-10"
      >
        <Icon icon={Trash2} size="sm" />
      </Button>

      <ConfirmSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={error ? t("revokeErrorTitle") : t("revokeTitle")}
        message={error ?? t("revokeMessage", { name })}
        confirmLabel={error ? t("revokeTryAgain") : t("revokeConfirm")}
        onConfirm={handleConfirm}
      />
    </>
  );
}

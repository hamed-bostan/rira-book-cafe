"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";
import { TeamMemberDialog } from "./TeamMemberDialog";

type RemoveAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  name: string;
};

/**
 * Withdraws a member's dashboard access, once confirmed. Only offered on rows the
 * server would allow (see `revokeBlocked`); the API still enforces every rule, and
 * a refusal reads in the dialog.
 */
export function RemoveAccessDialog({ open, onOpenChange, id, name }: RemoveAccessDialogProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.revoke(id);
        toast({ tone: "success", title: t("remove.done", { name }) });
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("remove.error")));
      }
    });
  }

  return (
    <TeamMemberDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("remove.title", { name })}
      message={t("remove.message")}
      submitLabel={t("remove.confirm")}
      destructive
      pending={pending}
      onSubmit={submit}
      error={error}
    />
  );
}

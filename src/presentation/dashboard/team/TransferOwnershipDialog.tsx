"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";

/**
 * Which direction ownership is moving, which decides the copy:
 *
 * - `transfer` — handing it to someone else. The caller steps down.
 * - `claim` — taking a seat nobody holds (a fresh deployment, bootstrapped by a
 *   break-glass admin).
 * - `takeOver` — taking it *off* a sitting owner. Only reachable with break-glass
 *   access, and worded as the emergency power it is: ordinary products make
 *   ownership push-only precisely so it can't be seized.
 */
export type TransferIntent = "transfer" | "claim" | "takeOver";

type TransferOwnershipDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id: string;
  name: string;
  intent: TransferIntent;
};

/**
 * Moves ownership of the cafe, once confirmed. The `transfer` wording doesn't
 * claim the move is irreversible from this side: a break-glass admin can take
 * ownership back, and promising otherwise would mislead the one person most
 * likely to be reading it.
 */
export function TransferOwnershipDialog({ open, onOpenChange, id, name, intent }: TransferOwnershipDialogProps) {
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
        await teamApi.transferOwnership(id);
        toast({
          tone: "success",
          title: intent === "transfer" ? t("ownership.transferred", { name }) : t("ownership.claimed"),
        });
        onOpenChange(false);
        // The caller may be an admin now, so the page stops being theirs to
        // manage — the server render is what says so.
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("ownership.error")));
      }
    });
  }

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(`ownership.${intent}.title`)}
      subtitle={t(`ownership.${intent}.message`, { name })}
      submitLabel={t(`ownership.${intent}.confirm`)}
      pending={pending}
      onSubmit={submit}
      error={error}
    />
  );
}

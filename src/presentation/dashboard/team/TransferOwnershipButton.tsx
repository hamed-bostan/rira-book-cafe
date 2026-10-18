"use client";

import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamApi } from "./team-api";

/**
 * Which direction ownership is moving, which decides the confirmation copy:
 *
 * - `transfer` — handing it to someone else. The caller steps down.
 * - `claim` — taking a seat nobody holds (a fresh deployment, bootstrapped by a
 *   break-glass admin).
 * - `takeOver` — taking it *off* a sitting owner. Only reachable with break-glass
 *   access, and worded as the emergency power it is: ordinary products make
 *   ownership push-only precisely so it can't be seized.
 */
type TransferIntent = "transfer" | "claim" | "takeOver";

type TransferOwnershipButtonProps = {
  id: string;
  name: string;
  intent: TransferIntent;
};

/**
 * Move ownership of the cafe, behind a confirmation.
 *
 * The copy is per-{@link TransferIntent} because the same request means very
 * different things to the person making it. The `transfer` wording deliberately
 * doesn't claim the move is irreversible from this side: a break-glass admin can
 * take ownership back, and promising otherwise was a lie to the one person most
 * likely to be reading it.
 */
export function TransferOwnershipButton({ id, name, intent }: TransferOwnershipButtonProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const label = t(`ownership.${intent}.aria`, { name });

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await teamApi.transferOwnership(id);
        setOpen(false);
        toast({
          tone: "success",
          title: intent === "transfer" ? t("ownership.transferred", { name }) : t("ownership.claimed"),
        });
        // Re-run the server render: the caller is an admin now, so the team page
        // stops being theirs to manage and the server is what says so.
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("transferError")));
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
        aria-label={label}
        title={label}
        onClick={() => setOpen(true)}
        loading={pending}
        className="size-11 sm:size-10"
      >
        <Icon icon={Crown} size="sm" />
      </Button>

      <ConfirmSheet
        open={open}
        onOpenChange={handleOpenChange}
        title={error ? t("transferErrorTitle") : t(`ownership.${intent}.title`)}
        message={error ?? t(`ownership.${intent}.message`, { name })}
        confirmLabel={error ? t("transferTryAgain") : t(`ownership.${intent}.confirm`)}
        onConfirm={handleConfirm}
      />
    </>
  );
}

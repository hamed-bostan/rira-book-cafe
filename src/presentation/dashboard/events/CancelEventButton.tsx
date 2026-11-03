"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DANGER_SECONDARY } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { eventsApi } from "./event-api";

type CancelEventButtonProps = {
  id: string;
  title: string;
  /** Guests signed up now — each is told, and their sign-up cancelled. */
  guests: number;
};

/**
 * "Cancel event" behind a confirmation: every sign-up is cancelled, the event
 * comes off the site, and each guest is told — the one step that used to take a
 * cancel per guest. Paid tickets stay on the guest list as owed back. Refreshes
 * after, so the list shows the cancelled sign-ups and the event as a draft.
 */
export function CancelEventButton({ id, title, guests }: CancelEventButtonProps) {
  const t = useTranslations("dashEvents");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleConfirm(): void {
    setError(null);
    startTransition(async () => {
      try {
        await eventsApi.cancel(id);
        toast({ tone: "success", title: t("cancelEventToast", { title }) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("cancelEventError")));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className={cn("px-3", DANGER_SECONDARY)}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("cancelEvent")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("cancelEventTitle", { title })}
        subtitle={t("cancelEventMessage", { count: guests })}
        submitLabel={t("cancelEventConfirm")}
        backLabel={t("cancelEventBack")}
        pending={pending}
        onSubmit={handleConfirm}
        error={error}
        danger
      />
    </>
  );
}

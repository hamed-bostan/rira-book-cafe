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

/**
 * Delete an event behind a confirmation. The API refuses while guests are still
 * registered (409) — the dialog then explains, and staff unpublish or cancel the
 * sign-ups instead.
 */
export function DeleteEventButton({ id, title }: { id: string; title: string }) {
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
        await eventsApi.remove(id);
        toast({ tone: "success", title: t("deleted", { title }) });
        setOpen(false);
        router.push("/dashboard/events");
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("deleteError")));
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
        onClick={() => setOpen(true)}
      >
        {t("delete")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={error ? t("deleteErrorTitle") : t("deleteTitle")}
        subtitle={t("deleteMessage", { title })}
        submitLabel={error ? t("deleteTryAgain") : t("deleteConfirm")}
        pending={pending}
        onSubmit={handleConfirm}
        error={error}
        danger
      />
    </>
  );
}

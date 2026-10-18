"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { eventsApi } from "./event-api";

/**
 * Delete an event behind a confirmation. The API refuses while guests are still
 * registered (409) — the sheet then explains, and staff unpublish or cancel the
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
        setOpen(true);
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        loading={pending}
        className="text-destructive"
      >
        <Icon icon={Trash2} size="sm" className="me-1.5" />
        {t("delete")}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={error ? t("deleteErrorTitle") : t("deleteTitle")}
        message={error ?? t("deleteMessage", { title })}
        confirmLabel={error ? t("deleteTryAgain") : t("deleteConfirm")}
        onConfirm={handleConfirm}
      />
    </>
  );
}

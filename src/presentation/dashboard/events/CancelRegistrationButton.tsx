"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { eventsApi } from "./event-api";

type CancelRegistrationButtonProps = {
  eventId: string;
  registrationId: string;
  guestName: string;
};

/** Cancel one guest's sign-up, freeing their seats. Confirms first; refreshes after. */
export function CancelRegistrationButton({ eventId, registrationId, guestName }: CancelRegistrationButtonProps) {
  const t = useTranslations("dashEvents");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function handleConfirm(): void {
    setOpen(false);
    startTransition(async () => {
      try {
        await eventsApi.cancelRegistration(eventId, registrationId);
        toast({ tone: "success", title: t("registrationCancelledToast", { name: guestName }) });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("cancelRegistrationError")) });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        loading={pending}
        onClick={() => setOpen(true)}
      >
        {t("cancelRegistration")}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("cancelRegistrationTitle", { name: guestName })}
        message={t("cancelRegistrationMessage")}
        confirmLabel={t("cancelRegistration")}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

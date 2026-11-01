"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
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
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-sm"
        className="px-2 text-error-foreground hover:bg-error active:bg-error"
        loading={pending}
        onClick={() => setOpen(true)}
      >
        {t("cancelRegistration")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("cancelRegistrationTitle", { name: guestName })}
        subtitle={t("cancelRegistrationMessage")}
        submitLabel={t("cancelRegistration")}
        pending={false}
        onSubmit={handleConfirm}
        danger
      />
    </>
  );
}

"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { reservationsApi } from "@/src/presentation/dashboard/reservations/reservation-api";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

type ConfirmReservationButtonProps = {
  reservationId: string;
  reference: number;
  guestName: string;
};

/**
 * Accept a requested booking in one tap, keeping whatever table it has (or none —
 * one can be assigned from the reservations page). Writes over the REST API, then
 * `router.refresh()`es.
 */
export function ConfirmReservationButton({ reservationId, reference, guestName }: ConfirmReservationButtonProps) {
  const t = useTranslations("dashOverview");
  const tRes = useTranslations("dashReservations");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function confirm(): void {
    startTransition(async () => {
      try {
        await reservationsApi.update(reservationId, { status: "confirmed" });
        toast({ tone: "success", title: t("reservationConfirmed", { name: guestName }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("reservationError")) });
      }
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="control-md"
      loading={pending}
      onClick={confirm}
      aria-label={t("confirmReservationAria", { reference, name: guestName })}
      className="ms-auto shrink-0 px-3"
    >
      {tRes("action.confirmed")}
    </Button>
  );
}

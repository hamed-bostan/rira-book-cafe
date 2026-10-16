"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { storefrontApi } from "../storefront-api";

/** The guest withdraws a booking before it starts. Confirms first; refreshes after. */
export function CancelMyReservationButton({ reservationId }: { reservationId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setOpen(true)}>
        {t("reservations.cancel")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("reservations.cancelTitle")}
        message={t("reservations.cancelMessage")}
        confirmLabel={t("reservations.cancel")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          setOpen(false);
          setError(null);
          startTransition(async () => {
            try {
              await storefrontApi.cancelReservation(reservationId);
            } catch (err) {
              setError(localizeApiError(err, tApiErrors, t("reservations.cancelError")));
            }
            router.refresh();
          });
        }}
      />
    </div>
  );
}

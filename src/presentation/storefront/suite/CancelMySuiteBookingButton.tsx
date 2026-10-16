"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { storefrontApi } from "../storefront-api";

/** The guest withdraws a stay before the check-in day. Confirms first; refreshes after. */
export function CancelMySuiteBookingButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setOpen(true)}>
        {t("suite.cancel")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("suite.cancelTitle")}
        message={t("suite.cancelMessage")}
        confirmLabel={t("suite.cancel")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          setOpen(false);
          setError(null);
          startTransition(async () => {
            try {
              await storefrontApi.cancelSuiteBooking(bookingId);
            } catch (err) {
              setError(localizeApiError(err, tApiErrors, t("suite.cancelError")));
            }
            router.refresh();
          });
        }}
      />
    </div>
  );
}

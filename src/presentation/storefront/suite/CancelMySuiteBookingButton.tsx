"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

/** The guest withdraws a stay before the check-in day. Confirms first; refreshes after. */
export function CancelMySuiteBookingButton({ bookingId }: { bookingId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

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
        {t("suite.cancel")}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("suite.cancelTitle")}
        message={t("suite.cancelMessage")}
        confirmLabel={t("suite.cancel")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          setOpen(false);
          startTransition(async () => {
            try {
              await storefrontApi.cancelSuiteBooking(bookingId);
              toast({ tone: "success", title: t("suite.cancelled") });
            } catch (err) {
              toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("suite.cancelError")) });
            }
            router.refresh();
          });
        }}
      />
    </div>
  );
}

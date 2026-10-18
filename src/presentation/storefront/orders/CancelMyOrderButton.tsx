"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, ConfirmSheet, useToast } from "@/src/presentation/design-system";

import { storefrontApi } from "../storefront-api";

/** The guest withdraws an order the cafe hasn't picked up yet. 409 once staff accepted it — the refresh shows why. */
export function CancelMyOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" variant="outline" loading={pending} onClick={() => setOpen(true)}>
        {t("orders.cancel")}
      </Button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("orders.cancelTitle")}
        message={t("orders.cancelMessage")}
        confirmLabel={t("orders.cancel")}
        cancelLabel={t("keep")}
        onConfirm={() => {
          setOpen(false);
          startTransition(async () => {
            try {
              await storefrontApi.cancelOrder(orderId);
              toast({ tone: "success", title: t("orders.cancelled") });
            } catch (err) {
              toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("orders.cancelError")) });
            }
            router.refresh();
          });
        }}
      />
    </div>
  );
}

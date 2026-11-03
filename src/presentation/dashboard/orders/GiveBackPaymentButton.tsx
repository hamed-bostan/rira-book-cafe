"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { onlinePaymentsApi } from "./online-payment-api";

type GiveBackPaymentButtonProps = {
  paymentId: string;
  orderNumber: number;
  amount: number;
};

/**
 * "Given back in Zarinpal": once staff have refunded an online payment no order
 * took from the gateway's panel, they say so here, after a confirmation — it takes
 * the payment off the Orders list's warning for good. Writes over the API, then
 * refreshes the server render.
 */
export function GiveBackPaymentButton({ paymentId, orderNumber, amount }: GiveBackPaymentButtonProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await onlinePaymentsApi.update(paymentId, { status: "refunded" });
        toast({ tone: "success", title: t("onlinePayments.givenBackToast", { number: orderNumber }) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("onlinePayments.giveBackError")));
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("onlinePayments.giveBack")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("onlinePayments.giveBackTitle", { amount: formatMoney(amount, locale) })}
        subtitle={t("onlinePayments.giveBackSubtitle")}
        submitLabel={t("onlinePayments.giveBackConfirm")}
        pending={pending}
        onSubmit={submit}
        error={error}
      />
    </>
  );
}

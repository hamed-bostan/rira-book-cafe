"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_WRITE_OFF_REASON_LENGTH, type Order } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { DANGER_SECONDARY } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";

import { ordersApi } from "./order-api";

type WriteOffOrderButtonProps = {
  order: Pick<Order, "id" | "orderNumber" | "total">;
};

/**
 * Write off a served order nobody paid for — a guest who walked out — after a
 * confirmation that says what it does, with a reason if staff want to give one.
 * Writes over the API, then refreshes the server render.
 */
export function WriteOffOrderButton({ order }: WriteOffOrderButtonProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.writeOff(order.id, { reason });
        toast({ tone: "success", title: t("writeOff.saved", { number: order.orderNumber }) });
        setOpen(false);
        setReason("");
        router.refresh();
      } catch (err) {
        const field = err instanceof ApiError ? err.fieldErrors?.reason : undefined;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ??
            localizeApiError(err, tApiErrors, t("writeOff.error")),
        );
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
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("writeOff.open")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("writeOff.title", { number: order.orderNumber })}
        subtitle={t("writeOff.subtitle")}
        submitLabel={t("writeOff.submit")}
        pending={pending}
        onSubmit={submit}
        preview={t("writeOff.preview", { amount: formatMoney(order.total, locale) })}
        previewTone="warning"
        error={error}
        danger
      >
        <DashboardField label={t("writeOff.reasonLabel")}>
          <Input
            size="control-md"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={MAX_WRITE_OFF_REASON_LENGTH}
            autoComplete="off"
            dir="auto"
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}

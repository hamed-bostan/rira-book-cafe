"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { MAX_TABLE_LABEL_LENGTH, type Order, type ServiceType } from "@/src/domain/entities/Order";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

type ChangeOrderServiceDialogProps = {
  order: Pick<Order, "id" | "orderNumber" | "updatedAt" | "serviceType" | "tableLabel">;
};

/**
 * Move an order to another table, or switch it between dine-in and takeaway — any
 * time before it's served, paid or not: where it goes doesn't change what it costs.
 * Writes over the API, then refreshes the server render.
 */
export function ChangeOrderServiceDialog({ order }: ChangeOrderServiceDialogProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [serviceType, setServiceType] = React.useState<ServiceType>(order.serviceType);
  const [tableLabel, setTableLabel] = React.useState(order.tableLabel ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const table = tableLabel.trim();
  const unchanged =
    serviceType === order.serviceType && (serviceType === "takeaway" || table === (order.tableLabel ?? ""));
  const ready = serviceType === "takeaway" || table !== "";

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.update(order.id, {
          version: order.updatedAt,
          serviceType,
          tableLabel: serviceType === "dineIn" ? table : undefined,
        });
        toast({ tone: "success", title: t("edit.serviceSaved", { number: order.orderNumber }) });
        setOpen(false);
      } catch (err) {
        const field =
          err instanceof ApiError ? Object.values(err.fieldErrors ?? {}).find((message) => message.length > 0) : null;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ?? localizeApiError(err, tApiErrors, t("edit.error")),
        );
      }
      router.refresh();
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
          setServiceType(order.serviceType);
          setTableLabel(order.tableLabel ?? "");
          setOpen(true);
        }}
      >
        {t("edit.serviceOpen")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("edit.serviceTitle", { number: order.orderNumber })}
        subtitle={t("edit.serviceSubtitle")}
        submitLabel={t("edit.serviceSubmit")}
        blocked={unchanged || !ready}
        pending={pending}
        onSubmit={submit}
        error={error}
      >
        <OverviewSegmented
          label={t("colService")}
          value={serviceType}
          onChange={setServiceType}
          fill
          options={[
            { value: "takeaway", label: t("service.takeaway") },
            { value: "dineIn", label: t("service.dineIn") },
          ]}
        />
        {serviceType === "dineIn" ? (
          <DashboardField label={t("counter.tableLabel")}>
            <Input
              size="control-md"
              value={tableLabel}
              onChange={(event) => setTableLabel(event.target.value)}
              maxLength={MAX_TABLE_LABEL_LENGTH}
              autoComplete="off"
              dir="auto"
            />
          </DashboardField>
        ) : null}
      </DashboardDialog>
    </>
  );
}

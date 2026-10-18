"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

type OrderItemServeToggleProps = {
  orderId: string;
  itemId: string;
  itemName: string;
  served: boolean;
};

/**
 * Tick one line off as it goes out to the guest, or take a mistaken tick back.
 * Writes, then refreshes the server render.
 */
export function OrderItemServeToggle({ orderId, itemId, itemName, served }: OrderItemServeToggleProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function toggle(): void {
    startTransition(async () => {
      try {
        await ordersApi.setItemServed(orderId, itemId, { served: !served });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("serveError")) });
      }
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={served ? "ghost" : "soft"}
      loading={pending}
      aria-label={t(served ? "unmarkServedAria" : "markServedAria", { name: itemName })}
      onClick={toggle}
    >
      {t(served ? "unmarkServed" : "markServed")}
    </Button>
  );
}

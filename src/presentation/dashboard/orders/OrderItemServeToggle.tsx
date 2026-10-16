"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage } from "@/src/presentation/design-system";

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
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function toggle(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.setItemServed(orderId, itemId, { served: !served });
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("serveError")));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant={served ? "ghost" : "soft"}
        disabled={pending}
        aria-label={t(served ? "unmarkServedAria" : "markServedAria", { name: itemName })}
        onClick={toggle}
      >
        {t(served ? "unmarkServed" : "markServed")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}

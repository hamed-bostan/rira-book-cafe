"use client";

import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { storefrontApi } from "../storefront-api";

/**
 * The guest pays their order online: the API opens a payment at the gateway and
 * the browser leaves for the gateway's page. They come back to this order through
 * the payment callback, which verifies the payment before anything is marked paid.
 */
export function PayOnlineButton({ orderId }: { orderId: string }) {
  const t = useTranslations("site");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [redirecting, setRedirecting] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const pay = (): void => {
    startTransition(async () => {
      try {
        const { redirectUrl } = await storefrontApi.payOrder(orderId);
        setRedirecting(true);
        window.location.assign(redirectUrl);
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("orders.pay.error")) });
        // A 409 means the order changed (paid, cancelled) — show its real state.
        router.refresh();
      }
    });
  };

  const busy = pending || redirecting;
  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" loading={busy} onClick={pay}>
        {busy ? null : <Icon icon={CreditCard} size="sm" className="me-1.5" />}
        {redirecting ? t("orders.pay.redirecting") : t("orders.pay.button")}
      </Button>
      <p className="text-center text-body-caption text-muted-foreground">{t("orders.pay.hint")}</p>
    </div>
  );
}

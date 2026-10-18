"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

/** Switch a promo code on or off from the list. */
export function PromoActiveSwitch({ id, code, isActive }: { id: string; code: string; isActive: boolean }) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function toggle(next: boolean): void {
    startTransition(async () => {
      try {
        await promotionsApi.setPromoCodeActive(id, { isActive: next });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("saveError")) });
      }
      router.refresh();
    });
  }

  return (
    <Switch checked={isActive} disabled={pending} onCheckedChange={toggle} aria-label={t("activeAria", { code })} />
  );
}

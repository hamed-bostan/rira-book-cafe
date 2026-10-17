"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormMessage, Switch } from "@/src/presentation/design-system";

import { promotionsApi } from "./promotion-api";

/** Switch a promo code on or off from the list. */
export function PromoActiveSwitch({ id, code, isActive }: { id: string; code: string; isActive: boolean }) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function toggle(next: boolean): void {
    setError(null);
    startTransition(async () => {
      try {
        await promotionsApi.setPromoCodeActive(id, { isActive: next });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("saveError")));
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Switch checked={isActive} disabled={pending} onCheckedChange={toggle} aria-label={t("activeAria", { code })} />
      {error ? <FormMessage>{error}</FormMessage> : null}
    </span>
  );
}

"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { promotionsApi } from "./promotion-api";

type PromoActiveSwitchProps = {
  id: string;
  code: string;
  isActive: boolean;
};

/**
 * A code's on/off switch in the list, with the state word beside it. Writes over
 * the REST API and `router.refresh()`es. The label around it — switch and word —
 * is the touch target, 44px tall on a phone.
 */
export function PromoActiveSwitch({ id, code, isActive }: PromoActiveSwitchProps) {
  const t = useTranslations("dashPromotions");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const switchId = React.useId();

  function toggle(next: boolean): void {
    startTransition(async () => {
      try {
        await promotionsApi.setPromoCodeActive(id, { isActive: next });
        toast({ tone: "success", title: next ? t("turnedOn", { code }) : t("turnedOff", { code }) });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("saveError")) });
      }
      router.refresh();
    });
  }

  return (
    <label htmlFor={switchId} className="flex min-h-11 cursor-pointer items-center gap-3 sm:min-h-8">
      <Switch
        id={switchId}
        size="sm"
        checked={isActive}
        disabled={pending}
        onCheckedChange={toggle}
        aria-label={t("activeAria", { code })}
      />
      <span className="text-body-default whitespace-nowrap text-foreground/80 sm:text-body-small">
        {isActive ? t("switchOn") : t("switchOff")}
      </span>
    </label>
  );
}

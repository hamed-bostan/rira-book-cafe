"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { accountsApi } from "./accounting-api";

/** Switch an account on or off. An inactive account keeps its history and takes no new postings. */
export function AccountActiveSwitch({ code, isActive }: { code: string; isActive: boolean }) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const switchId = React.useId();

  // The label names the switch and toggles it too, so a phone's 44px square
  // reaches past the switch's 36×20.
  return (
    <label
      htmlFor={switchId}
      className="flex min-h-11 min-w-11 cursor-pointer items-center justify-end sm:min-h-8 sm:min-w-0"
    >
      <span className="sr-only">{t("accounts.activeLabel", { code })}</span>
      <Switch
        id={switchId}
        size="sm"
        checked={isActive}
        disabled={pending}
        onCheckedChange={(next) => {
          startTransition(async () => {
            try {
              await accountsApi.setActive(code, next);
              router.refresh();
            } catch (err) {
              toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("accounts.error")) });
            }
          });
        }}
      />
    </label>
  );
}

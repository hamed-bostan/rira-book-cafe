"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { FormMessage, Switch } from "@/src/presentation/design-system";

import { accountsApi } from "./accounting-api";

/** Switch an account on or off. An inactive account keeps its history and takes no new postings. */
export function AccountActiveSwitch({ code, isActive }: { code: string; isActive: boolean }) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  return (
    <span className="flex items-center gap-2">
      <Switch
        checked={isActive}
        disabled={pending}
        aria-label={t("accounts.activeLabel", { code })}
        onCheckedChange={(next) => {
          setError(null);
          startTransition(async () => {
            try {
              await accountsApi.setActive(code, next);
              router.refresh();
            } catch (err) {
              setError(localizeApiError(err, tApiErrors, t("accounts.error")));
            }
          });
        }}
      />
      {error ? <FormMessage>{error}</FormMessage> : null}
    </span>
  );
}

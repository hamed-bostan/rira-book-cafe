"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { ConfirmSheet, FormMessage } from "@/src/presentation/design-system";

import { pricingApi } from "./pricing-api";

type ApplyPriceButtonProps = { productId: string; name: string; currentPrice: number; suggestedPrice: number };

/** Put the suggested price on the menu, after a confirmation naming both prices. */
export function ApplyPriceButton({ productId, name, currentPrice, suggestedPrice }: ApplyPriceButtonProps) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function apply(): void {
    setError(null);
    startTransition(async () => {
      try {
        await pricingApi.applySuggestion(productId, currentPrice);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("applyError")));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="block w-full text-end text-body-caption text-primary underline-offset-4 hover:underline disabled:opacity-50"
      >
        {t("apply")}
      </button>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("applyTitle", { name })}
        message={t("applyMessage", { from: formatMoney(currentPrice, locale), to: formatMoney(suggestedPrice, locale) })}
        confirmLabel={t("applyConfirm")}
        onConfirm={apply}
      />
    </>
  );
}

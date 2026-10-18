"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { ConfirmSheet } from "@/src/presentation/design-system/components/Sheet/ConfirmSheet";
import { Spinner } from "@/src/presentation/design-system/components/Spinner/Spinner";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { pricingApi } from "./pricing-api";

type ApplyPriceButtonProps = { productId: string; name: string; currentPrice: number; suggestedPrice: number };

/** Put the suggested price on the menu, after a confirmation naming both prices. */
export function ApplyPriceButton({ productId, name, currentPrice, suggestedPrice }: ApplyPriceButtonProps) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function apply(): void {
    startTransition(async () => {
      try {
        await pricingApi.applySuggestion(productId, currentPrice);
        toast({ tone: "success", title: t("applied", { name, price: formatMoney(suggestedPrice, locale) }) });
        router.refresh();
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("applyError")) });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-busy={pending || undefined}
        className="block w-full text-end text-body-caption text-primary underline-offset-4 hover:underline disabled:opacity-50"
      >
        {/* A text link rather than a DS Button, so the spinner is placed by hand. */}
        {pending ? <Spinner decorative size="xs" className="me-1 inline-block align-middle" /> : null}
        {t("apply")}
      </button>
      <ConfirmSheet
        open={open}
        onOpenChange={setOpen}
        title={t("applyTitle", { name })}
        message={t("applyMessage", {
          from: formatMoney(currentPrice, locale),
          to: formatMoney(suggestedPrice, locale),
        })}
        confirmLabel={t("applyConfirm")}
        onConfirm={apply}
      />
    </>
  );
}

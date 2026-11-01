"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
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
    setOpen(false);
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
        className={cn(
          "-my-3 py-3 text-body-small font-medium whitespace-nowrap text-primary hover:underline disabled:opacity-50 sm:my-0 sm:py-0 sm:text-body-caption",
          focusRing,
        )}
      >
        {/* A text action rather than a DS Button, so the spinner is placed by hand. */}
        {pending ? <Spinner decorative size="xs" className="me-1 inline-block align-middle" /> : null}
        {t("apply")}
      </button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("applyTitle", { name })}
        subtitle={t("applyMessage", {
          from: formatMoney(currentPrice, locale),
          to: formatMoney(suggestedPrice, locale),
        })}
        submitLabel={t("applyConfirm")}
        backLabel={t("cancel")}
        pending={false}
        onSubmit={apply}
      />
    </>
  );
}

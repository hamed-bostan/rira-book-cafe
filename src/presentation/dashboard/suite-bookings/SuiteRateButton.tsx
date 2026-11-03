"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { suiteRateSchema } from "@/src/contracts/booking-money-schema";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { expenseApiErrorMessage } from "@/src/presentation/dashboard/expenses/expenseApiErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { TEXT_ACTION } from "../fieldStyles";

import { suitePricesApi } from "./suite-price-api";

type SuiteRateButtonProps = {
  stayId: string;
  reference: number;
  /** The stay's nights, and their count — "3 nights · Oct 22 → Oct 25". */
  nights: number;
  nightsLabel: string;
  /** The rate it has now; absent for a stay from before the suite had a price. */
  nightlyRate?: number;
};

/**
 * "Change rate" beside a stay's total: price this one stay differently — a
 * returning guest, a long stay. The total follows (nights × rate), as the preview shows.
 */
export function SuiteRateButton({ stayId, reference, nights, nightsLabel, nightlyRate }: SuiteRateButtonProps) {
  const t = useTranslations("dashSuite");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [rate, setRate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const parsed = suiteRateSchema.safeParse({ nightlyRate: normalizeAmount(rate) });
  const fieldError = rate.trim() !== "" && !parsed.success ? tFormErrors("amountInvalid") : undefined;
  const ready = parsed.success && parsed.data.nightlyRate !== nightlyRate;

  function openDialog(): void {
    setRate(nightlyRate === undefined ? "" : String(nightlyRate));
    setError(null);
    setOpen(true);
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        const saved = await suitePricesApi.updateStay(stayId, { nightlyRate: normalizeAmount(rate) });
        toast({
          tone: "success",
          title: t("rate.saved", { reference, amount: formatMoney(saved.nightlyRate ?? 0, locale) }),
        });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("rate.error")));
      }
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("rate.aria", { reference })}
        className={cn(TEXT_ACTION, focusRing, "text-primary hover:text-primary-hover")}
        onClick={openDialog}
      >
        {t("rate.button")}
      </button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("rate.title", { reference })}
        subtitle={t("rate.subtitle", { nights: nightsLabel })}
        submitLabel={t("rate.save")}
        blocked={!ready}
        pending={pending}
        onSubmit={submit}
        preview={
          parsed.success
            ? t("rate.preview", {
                nights: formatNumber(nights, locale),
                rate: formatNumber(parsed.data.nightlyRate, locale),
                total: formatMoney(nights * parsed.data.nightlyRate, locale),
              })
            : undefined
        }
        error={fieldError ?? error}
      >
        <DashboardField label={t("rate.label")}>
          <Input
            size="control-md"
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            autoComplete="off"
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}

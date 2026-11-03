"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm } from "react-hook-form";

import { suiteRateSchema, type SuiteRateInput } from "@/src/contracts/booking-money-schema";
import type { SuiteSettings } from "@/src/domain/entities/SuitePricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { FIELD_HINT, FIELD_INPUT } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { suitePricesApi } from "@/src/presentation/dashboard/suite-bookings/suite-price-api";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

/**
 * What a night in the suite costs. New stays snapshot it as they're made; stays
 * already booked keep their own rate (the desk can change one stay's on its row).
 */
export function SuitePriceForm({ settings, canWrite }: { settings: SuiteSettings; canWrite: boolean }) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const headingId = React.useId();

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SuiteRateInput>({
    resolver: zodResolver(suiteRateSchema, undefined, { raw: true }),
    defaultValues: { nightlyRate: String(settings.nightlyRate) },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await suitePricesApi.updateDefault(values);
      reset({ nightlyRate: String(saved.nightlyRate) });
      toast({ tone: "success", title: t("suite.saved") });
      router.refresh();
    } catch (error) {
      const field = error instanceof ApiError ? error.fieldErrors?.nightlyRate : undefined;
      if (field) setError("nightlyRate", { message: field });
      else setError("root", { message: localizeApiError(error, tApiErrors, t("suite.error")) });
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      aria-labelledby={headingId}
      className="min-w-0 rounded-card-lg border border-border bg-background p-5 shadow-xs"
      noValidate
    >
      <div className="flex max-w-md flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="text-body-lead font-semibold text-foreground">
            {t("suite.heading")}
          </h2>
          <p className={FIELD_HINT}>{t("suite.description")}</p>
        </div>
        <DashboardFormField
          label={t("suite.rateLabel")}
          required
          error={formErrorMessage(tFormErrors, errors.nightlyRate?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("nightlyRate")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              inputMode="numeric"
              dir="ltr"
              className="max-w-48"
              disabled={!canWrite}
            />
          )}
        </DashboardFormField>
        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
        {canWrite ? (
          <Button type="submit" size="control-md" className="w-fit px-4" loading={isSubmitting} disabled={!isDirty}>
            {t("suite.save")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

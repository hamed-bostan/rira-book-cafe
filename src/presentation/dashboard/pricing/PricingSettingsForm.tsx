"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

import { pricingSettingsSchema, type PricingSettingsInput } from "@/src/contracts/pricing-schema";
import { OVERHEAD_SOURCES, type PricingSettings } from "@/src/domain/entities/Pricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { DashboardFormField } from "@/src/presentation/dashboard/DashboardFormField";
import { FIELD_HINT, FIELD_INPUT, FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { pricingApi } from "./pricing-api";

const FIELDS = [
  "defaultMarkup",
  "roundingStep",
  "overheadSource",
  "manualMonthlyOverhead",
  "expectedMonthlyUnits",
  "overheadMonths",
  "monthlyInflation",
  "priceHorizonMonths",
] as const;

function toDefaults(settings: PricingSettings): PricingSettingsInput {
  return {
    defaultMarkup: String(settings.defaultMarkupBps / 100),
    roundingStep: String(settings.roundingStep),
    overheadSource: settings.overheadSource,
    manualMonthlyOverhead: settings.manualMonthlyOverhead === undefined ? "" : String(settings.manualMonthlyOverhead),
    expectedMonthlyUnits: settings.expectedMonthlyUnits === undefined ? "" : String(settings.expectedMonthlyUnits),
    overheadMonths: String(settings.overheadMonths),
    monthlyInflation: settings.monthlyInflationBps === 0 ? "" : String(settings.monthlyInflationBps / 100),
    priceHorizonMonths: String(settings.priceHorizonMonths),
  };
}

/**
 * The advisor's assumptions: the default profit, how prices round, where the
 * monthly running costs come from — the books (recorded expenses) or a planned
 * figure — and how fast costs are expected to rise until the next price change.
 */
export function PricingSettingsForm({ settings, canWrite }: { settings: PricingSettings; canWrite: boolean }) {
  const t = useTranslations("dashPricing");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();
  const sourceLabelId = React.useId();

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PricingSettingsInput>({
    resolver: zodResolver(pricingSettingsSchema, undefined, { raw: true }),
    defaultValues: toDefaults(settings),
  });
  const source = useWatch({ control, name: "overheadSource" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      reset(toDefaults(await pricingApi.updateSettings(values)));
      toast({ tone: "success", title: t("settings.saved") });
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("settings.error")) });
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      className="min-w-0 rounded-card-lg border border-border bg-background p-5 shadow-xs"
      noValidate
    >
      <div className="flex max-w-md flex-col gap-5">
        <DashboardFormField
          label={t("settings.defaultMarkupLabel")}
          required
          hint={t("settings.defaultMarkupHint")}
          error={fieldError(errors.defaultMarkup?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("defaultMarkup")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              inputMode="decimal"
              dir="ltr"
              disabled={!canWrite}
            />
          )}
        </DashboardFormField>

        <fieldset className="flex min-w-0 flex-col gap-1.5" disabled={!canWrite} aria-labelledby={sourceLabelId}>
          <span id={sourceLabelId} className={FIELD_LABEL}>
            {t("settings.overheadSourceLabel")}
          </span>
          <div className="flex flex-col gap-2">
            {OVERHEAD_SOURCES.map((option) => (
              <label
                key={option}
                className="group flex min-h-11 cursor-pointer items-start gap-3 rounded-button border border-border-strong bg-background p-3 transition-colors hover:border-accent-border has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring has-disabled:cursor-not-allowed sm:min-h-9"
              >
                <input type="radio" value={option} {...register("overheadSource")} className="peer sr-only" />
                <span
                  aria-hidden
                  className="mt-0.5 flex size-4 flex-none items-center justify-center rounded-full border-2 border-border-strong bg-background peer-checked:border-primary"
                >
                  <span className="size-2 rounded-full group-has-checked:bg-primary" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={FIELD_LABEL}>{t(`settings.source.${option}`)}</span>
                  <span className={FIELD_HINT}>{t(`settings.sourceHint.${option}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {source === "manual" ? (
          <DashboardFormField
            label={t("settings.manualOverheadLabel")}
            required
            hint={t("settings.manualOverheadHint")}
            error={fieldError(errors.manualMonthlyOverhead?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("manualMonthlyOverhead")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                inputMode="numeric"
                dir="ltr"
                disabled={!canWrite}
              />
            )}
          </DashboardFormField>
        ) : (
          <DashboardFormField
            label={t("settings.monthsLabel")}
            hint={t("settings.monthsHint")}
            error={fieldError(errors.overheadMonths?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("overheadMonths")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                inputMode="numeric"
                dir="ltr"
                disabled={!canWrite}
              />
            )}
          </DashboardFormField>
        )}

        <DashboardFormField
          label={t("settings.expectedUnitsLabel")}
          hint={t("settings.expectedUnitsHint")}
          error={fieldError(errors.expectedMonthlyUnits?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("expectedMonthlyUnits")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              inputMode="numeric"
              dir="ltr"
              disabled={!canWrite}
            />
          )}
        </DashboardFormField>

        <fieldset className="flex min-w-0 flex-col gap-4 rounded-card-lg border border-border p-4" disabled={!canWrite}>
          <legend className="px-1 text-body-default font-semibold text-foreground sm:text-body-small">
            {t("settings.inflationLegend")}
          </legend>
          <p className={FIELD_HINT}>{t("settings.inflationHint")}</p>
          <DashboardFormField
            label={t("settings.monthlyInflationLabel")}
            hint={t("settings.monthlyInflationHint")}
            error={fieldError(errors.monthlyInflation?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("monthlyInflation")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                inputMode="decimal"
                dir="ltr"
                placeholder="0"
              />
            )}
          </DashboardFormField>
          <DashboardFormField
            label={t("settings.horizonLabel")}
            hint={t("settings.horizonHint")}
            error={fieldError(errors.priceHorizonMonths?.message)}
          >
            {(wiring) => (
              <Input
                {...wiring}
                {...register("priceHorizonMonths")}
                size="control-md"
                inputClassName={FIELD_INPUT}
                inputMode="numeric"
                dir="ltr"
              />
            )}
          </DashboardFormField>
        </fieldset>

        <DashboardFormField
          label={t("settings.roundingLabel")}
          hint={t("settings.roundingHint")}
          error={fieldError(errors.roundingStep?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("roundingStep")}
              size="control-md"
              inputClassName={FIELD_INPUT}
              inputMode="numeric"
              dir="ltr"
              disabled={!canWrite}
            />
          )}
        </DashboardFormField>

        {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
        {canWrite ? (
          <Button type="submit" size="control-md" className="self-start" loading={isSubmitting} disabled={!isDirty}>
            {t("save")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

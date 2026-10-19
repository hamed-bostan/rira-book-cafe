"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { pricingSettingsSchema, type PricingSettingsInput } from "@/src/contracts/pricing-schema";
import { OVERHEAD_SOURCES, type PricingSettings } from "@/src/domain/entities/Pricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { TextField } from "@/src/presentation/design-system/components/form/TextField/TextField";
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
      className="flex max-w-xl flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6"
      noValidate
    >
      <TextField
        label={t("settings.defaultMarkupLabel")}
        required
        description={t("settings.defaultMarkupHint")}
        error={fieldError(errors.defaultMarkup?.message)}
      >
        {(control) => (
          <Input
            {...control}
            {...register("defaultMarkup")}
            inputMode="decimal"
            dir="ltr"
            className="max-w-32"
            disabled={!canWrite}
          />
        )}
      </TextField>

      <fieldset className="flex flex-col gap-2" disabled={!canWrite}>
        <legend className="mb-1 text-body-small-emphasis text-input-foreground">
          {t("settings.overheadSourceLabel")}
        </legend>
        {OVERHEAD_SOURCES.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-2 rounded-card-md border border-border px-3 py-2 text-body-small has-[:checked]:border-primary has-[:checked]:bg-accent"
          >
            <input type="radio" value={option} {...register("overheadSource")} className="mt-1 accent-primary" />
            <span>
              <span className="block text-body-small-emphasis text-foreground">{t(`settings.source.${option}`)}</span>
              <span className="text-body-caption text-muted-foreground">{t(`settings.sourceHint.${option}`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {source === "manual" ? (
        <TextField
          label={t("settings.manualOverheadLabel")}
          required
          description={t("settings.manualOverheadHint")}
          error={fieldError(errors.manualMonthlyOverhead?.message)}
        >
          {(control) => (
            <Input
              {...control}
              {...register("manualMonthlyOverhead")}
              inputMode="numeric"
              dir="ltr"
              disabled={!canWrite}
            />
          )}
        </TextField>
      ) : (
        <TextField
          label={t("settings.monthsLabel")}
          description={t("settings.monthsHint")}
          error={fieldError(errors.overheadMonths?.message)}
        >
          {(control) => (
            <Input
              {...control}
              {...register("overheadMonths")}
              inputMode="numeric"
              dir="ltr"
              className="max-w-24"
              disabled={!canWrite}
            />
          )}
        </TextField>
      )}

      <TextField
        label={t("settings.expectedUnitsLabel")}
        description={t("settings.expectedUnitsHint")}
        error={fieldError(errors.expectedMonthlyUnits?.message)}
      >
        {(control) => (
          <Input
            {...control}
            {...register("expectedMonthlyUnits")}
            inputMode="numeric"
            dir="ltr"
            className="max-w-40"
            disabled={!canWrite}
          />
        )}
      </TextField>

      <fieldset className="flex flex-col gap-3" disabled={!canWrite}>
        <legend className="mb-1 text-body-small-emphasis text-input-foreground">{t("settings.inflationLegend")}</legend>
        <p className="-mt-1 text-body-caption text-muted-foreground">{t("settings.inflationHint")}</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <TextField
            label={t("settings.monthlyInflationLabel")}
            description={t("settings.monthlyInflationHint")}
            error={fieldError(errors.monthlyInflation?.message)}
          >
            {(control) => (
              <Input
                {...control}
                {...register("monthlyInflation")}
                inputMode="decimal"
                dir="ltr"
                placeholder="0"
                className="max-w-24"
              />
            )}
          </TextField>
          <TextField
            label={t("settings.horizonLabel")}
            description={t("settings.horizonHint")}
            error={fieldError(errors.priceHorizonMonths?.message)}
          >
            {(control) => (
              <Input
                {...control}
                {...register("priceHorizonMonths")}
                inputMode="numeric"
                dir="ltr"
                className="max-w-24"
              />
            )}
          </TextField>
        </div>
      </fieldset>

      <TextField
        label={t("settings.roundingLabel")}
        description={t("settings.roundingHint")}
        error={fieldError(errors.roundingStep?.message)}
      >
        {(control) => (
          <Input
            {...control}
            {...register("roundingStep")}
            inputMode="numeric"
            dir="ltr"
            className="max-w-40"
            disabled={!canWrite}
          />
        )}
      </TextField>

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      {canWrite ? (
        <div>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {t("save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

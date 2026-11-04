"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { accountingSettingsSchema, type AccountingSettingsInput } from "@/src/contracts/accounting-schema";
import type { AccountingSettings } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_HINT, FIELD_INPUT } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { PAGE_CARD } from "../pageStyles";

import { accountsApi } from "./accounting-api";

/** "10" for 1000 bps, "9.5" for 950. */
function percentOf(bps: number): string {
  return String(bps / 100);
}

function formValues(settings: AccountingSettings): AccountingSettingsInput {
  return {
    vatRate: percentOf(settings.vatRateBps),
    serviceChargeRate: percentOf(settings.serviceChargeBps),
    booksClosedThrough: settings.booksClosedThrough ?? "",
  };
}

/**
 * The VAT rate inside menu prices, the service charge on dine-in orders (0 = none;
 * a change applies to orders placed from then on), and the period lock. Closing the books through a
 * day freezes every entry dated on or before it — moving it later closes more;
 * clearing it reopens everything (and is audited like any other change).
 */
export function AccountingSettingsForm({
  settings,
  today,
  canWrite,
}: {
  settings: AccountingSettings;
  today: string;
  canWrite: boolean;
}) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<AccountingSettingsInput>({
    resolver: zodResolver(accountingSettingsSchema, undefined, { raw: true }),
    defaultValues: formValues(settings),
  });
  const closedThrough = useWatch({ control, name: "booksClosedThrough" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const next = await accountsApi.updateSettings(values);
      reset(formValues(next));
      toast({ tone: "success", title: t("settings.savedToast") });
      router.refresh();
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors : undefined;
      if (fields?.vatRate) setError("vatRate", { message: fields.vatRate });
      else if (fields?.serviceChargeRate) setError("serviceChargeRate", { message: fields.serviceChargeRate });
      else if (fields?.booksClosedThrough) setError("booksClosedThrough", { message: fields.booksClosedThrough });
      else setError("root", { message: localizeApiError(error, tApiErrors, t("settings.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <DashboardFormField
        label={t("settings.vatRateLabel")}
        required
        hint={t("settings.vatRateHint")}
        error={fieldError(errors.vatRate?.message)}
      >
        {(field) => (
          <Input
            {...field}
            {...register("vatRate")}
            size="control-md"
            inputMode="decimal"
            dir="ltr"
            className="max-w-32"
            inputClassName={FIELD_INPUT}
            disabled={!canWrite}
          />
        )}
      </DashboardFormField>
      <DashboardFormField
        label={t("settings.serviceChargeLabel")}
        hint={t("settings.serviceChargeHint")}
        error={fieldError(errors.serviceChargeRate?.message)}
      >
        {(field) => (
          <Input
            {...field}
            {...register("serviceChargeRate")}
            size="control-md"
            inputMode="decimal"
            dir="ltr"
            className="max-w-32"
            inputClassName={FIELD_INPUT}
            disabled={!canWrite}
          />
        )}
      </DashboardFormField>
      <DashboardFormField
        label={t("settings.closedThroughLabel")}
        hint={t("settings.closedThroughHint")}
        error={fieldError(errors.booksClosedThrough?.message)}
      >
        {(field) => (
          <>
            <Input
              {...field}
              {...register("booksClosedThrough")}
              size="control-md"
              type="date"
              max={today}
              dir="ltr"
              className="max-w-48"
              inputClassName={FIELD_INPUT}
              disabled={!canWrite}
            />
            {closedThrough ? (
              <span className={cn(FIELD_HINT, "text-foreground")}>{formatCafeDayMedium(closedThrough, locale)}</span>
            ) : null}
          </>
        )}
      </DashboardFormField>
      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      {canWrite ? (
        <Button type="submit" size="control-md" className="w-fit px-4" loading={isSubmitting} disabled={!isDirty}>
          {t("settings.save")}
        </Button>
      ) : null}
    </form>
  );
}

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
import { Button, FormMessage, Input, TextField, useToast } from "@/src/presentation/design-system";

import { accountsApi } from "./accounting-api";

/** "10" for 1000 bps, "9.5" for 950. */
function percentOf(bps: number): string {
  return String(bps / 100);
}

/**
 * The VAT rate inside menu prices and the period lock. Closing the books through a
 * day freezes every entry dated on or before it — moving it later closes more;
 * clearing it reopens everything (and is audited like any other change).
 */
export function AccountingSettingsForm({ settings, today, canWrite }: { settings: AccountingSettings; today: string; canWrite: boolean }) {
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
    defaultValues: { vatRate: percentOf(settings.vatRateBps), booksClosedThrough: settings.booksClosedThrough ?? "" },
  });
  const closedThrough = useWatch({ control, name: "booksClosedThrough" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const next = await accountsApi.updateSettings(values);
      reset({ vatRate: percentOf(next.vatRateBps), booksClosedThrough: next.booksClosedThrough ?? "" });
      toast({ tone: "success", title: t("settings.savedToast") });
      router.refresh();
    } catch (error) {
      const fields = error instanceof ApiError ? error.fieldErrors : undefined;
      if (fields?.vatRate) setError("vatRate", { message: fields.vatRate });
      else if (fields?.booksClosedThrough) setError("booksClosedThrough", { message: fields.booksClosedThrough });
      else setError("root", { message: localizeApiError(error, tApiErrors, t("settings.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6" noValidate>
      <TextField label={t("settings.vatRateLabel")} required description={t("settings.vatRateHint")} error={fieldError(errors.vatRate?.message)}>
        {(control) => <Input {...control} {...register("vatRate")} inputMode="decimal" dir="ltr" className="max-w-32" disabled={!canWrite} />}
      </TextField>
      <TextField
        label={t("settings.closedThroughLabel")}
        description={
          <>
            {t("settings.closedThroughHint")}
            {closedThrough ? <span className="mt-1 block text-foreground">{formatCafeDayMedium(closedThrough, locale)}</span> : null}
          </>
        }
        error={fieldError(errors.booksClosedThrough?.message)}
      >
        {(control) => <Input {...control} {...register("booksClosedThrough")} type="date" max={today} dir="ltr" className="max-w-48" disabled={!canWrite} />}
      </TextField>
      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      {canWrite ? (
        <div>
          <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
            {t("settings.save")}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

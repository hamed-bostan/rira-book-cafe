"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";

import { gatewaySettlementSchema, type GatewaySettlementInput } from "@/src/contracts/payment-schema";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Input, TextField, useToast } from "@/src/presentation/design-system";

import { settlementsApi } from "./accounting-api";

const FORM_FIELDS = ["date", "deposited", "fee", "reference"] as const satisfies readonly (keyof GatewaySettlementInput)[];

const wholeToman = (value: string): number => (/^\d+$/.test(value.trim()) ? Number(value) : 0);

/**
 * Record a payout from the online gateway as the bank statement shows it: the
 * deposit and the fee the gateway kept. The server books Dr Bank + Dr fees /
 * Cr Gateway clearing, and refuses to clear more than the gateway holds.
 */
export function GatewaySettlementForm({ today }: { today: string }) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const empty: GatewaySettlementInput = { date: today, deposited: "", fee: "", reference: "" };
  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GatewaySettlementInput>({
    resolver: zodResolver(gatewaySettlementSchema, undefined, { raw: true }),
    defaultValues: empty,
  });
  const [date, deposited, fee] = useWatch({ control, name: ["date", "deposited", "fee"] });
  const clears = wholeToman(deposited) + wholeToman(fee);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await settlementsApi.create(values);
      reset(empty);
      toast({ tone: "success", title: t("overview.settlement.saved") });
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FORM_FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("overview.settlement.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-body-lead text-foreground">{t("overview.settlement.heading")}</h2>
        <p className="text-body-small text-muted-foreground">{t("overview.settlement.hint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("overview.settlement.date")} required description={date ? formatCafeDayMedium(date, locale) : undefined} error={fieldError(errors.date?.message)}>
          {(field) => <Input {...field} {...register("date")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField label={t("overview.settlement.reference")} error={fieldError(errors.reference?.message)}>
          {(field) => <Input {...field} {...register("reference")} dir="ltr" placeholder={t("overview.settlement.referencePlaceholder")} />}
        </TextField>
        <TextField label={t("overview.settlement.deposited")} required error={fieldError(errors.deposited?.message)}>
          {(field) => <Input {...field} {...register("deposited")} inputMode="numeric" dir="ltr" />}
        </TextField>
        <TextField label={t("overview.settlement.fee")} description={t("overview.settlement.feeHint")} error={fieldError(errors.fee?.message)}>
          {(field) => <Input {...field} {...register("fee")} inputMode="numeric" dir="ltr" />}
        </TextField>
      </div>
      {clears > 0 ? <p className="-mt-1 text-body-caption text-muted-foreground">{t("overview.settlement.clears", { amount: formatMoney(clears, locale) })}</p> : null}

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      <div>
        <Button type="submit" size="sm" loading={isSubmitting}>
          {t("overview.settlement.submit")}
        </Button>
      </div>
    </form>
  );
}

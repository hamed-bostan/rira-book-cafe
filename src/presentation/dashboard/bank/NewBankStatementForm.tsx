"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";

import { bankStatementSchema, type BankStatementFormInput } from "@/src/contracts/bank-schema";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { PAGE_CARD, ROW_TEXT } from "../pageStyles";

import { bankStatementsApi } from "./bank-statement-api";
import { parseStatementAmount } from "./parseStatementCsv";
import { linesTotal, StatementLinesFields, type StatementLinesForm } from "./StatementLinesFields";

const FORM_FIELDS = [
  "fromDay",
  "toDay",
  "openingBalance",
  "closingBalance",
  "lines",
] as const satisfies readonly (keyof BankStatementFormInput)[];

type NewBankStatementFormProps = {
  /** The suggested period — the Persian month after the last statement (or the last full month). */
  fromDay: string;
  toDay: string;
  /** The previous statement's closing balance, which this one must open at. */
  openingBalance?: number;
  today: string;
};

/**
 * Enter a bank statement: its period, its opening and closing balance as printed,
 * and its lines. The running check shows whether the lines take the opening
 * balance to the closing one before anything is saved.
 */
export function NewBankStatementForm({ fromDay, toDay, openingBalance, today }: NewBankStatementFormProps) {
  const t = useTranslations("dashBank");
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
    formState: { errors, isSubmitting },
  } = useForm<BankStatementFormInput>({
    resolver: zodResolver(bankStatementSchema, undefined, { raw: true }),
    defaultValues: {
      fromDay,
      toDay,
      openingBalance: openingBalance === undefined ? "" : String(openingBalance),
      closingBalance: "",
      lines: [],
    },
  });
  const [from, to, opening, closing, lines] = useWatch({
    control,
    name: ["fromDay", "toDay", "openingBalance", "closingBalance", "lines"],
  });
  const openingValue = parseStatementAmount(opening);
  const closingValue = parseStatementAmount(closing);
  const gap =
    openingValue !== null && closingValue !== null && closing.trim() !== ""
      ? closingValue - openingValue - linesTotal(lines)
      : null;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const statement = await bankStatementsApi.create(values);
      toast({ tone: "success", title: t("form.saved") });
      router.push(`/dashboard/accounting/bank/${statement.id}`);
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
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("form.error")) });
    }
  });

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <div className="grid grid-cols-2 items-start gap-4 md:grid-cols-4">
        <DashboardFormField
          label={t("form.fromDay")}
          required
          hint={from ? formatCafeDayMedium(from, locale) : undefined}
          error={fieldError(errors.fromDay?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("fromDay")}
              size="control-md"
              type="date"
              max={today}
              dir="ltr"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("form.toDay")}
          required
          hint={to ? formatCafeDayMedium(to, locale) : undefined}
          error={fieldError(errors.toDay?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("toDay")}
              size="control-md"
              type="date"
              max={today}
              dir="ltr"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("form.openingBalance")}
          required
          hint={openingBalance === undefined ? t("form.openingHintFirst") : t("form.openingHint")}
          error={fieldError(errors.openingBalance?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("openingBalance")}
              size="control-md"
              inputMode="numeric"
              dir="ltr"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("form.closingBalance")}
          required
          hint={t("form.closingHint")}
          error={fieldError(errors.closingBalance?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("closingBalance")}
              size="control-md"
              inputMode="numeric"
              placeholder="0"
              dir="ltr"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
      </div>

      <StatementLinesFields
        control={control as unknown as Control<StatementLinesForm>}
        register={register as unknown as UseFormRegister<StatementLinesForm>}
        errors={errors}
        defaultDay={to || today}
      />

      {gap !== null ? (
        <p
          className={cn(
            ROW_TEXT,
            "flex items-start gap-2 font-medium",
            gap === 0 ? "text-success-foreground" : "text-warning-foreground",
          )}
          aria-live="polite"
        >
          <Icon icon={gap === 0 ? CircleCheck : CircleAlert} size="icon-md" className="mt-0.5" />
          <span>{gap === 0 ? t("form.addsUp") : t("form.gap", { amount: formatNumber(gap, locale) })}</span>
        </p>
      ) : null}

      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("form.submit")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/accounting/bank">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

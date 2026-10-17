"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm, useWatch, type Control, type UseFormRegister } from "react-hook-form";

import { bankStatementSchema, type BankStatementFormInput } from "@/src/contracts/bank-schema";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Input, TextField, useToast } from "@/src/presentation/design-system";

import { bankStatementsApi } from "./bank-statement-api";
import { parseStatementAmount } from "./parseStatementCsv";
import { linesTotal, StatementLinesFields, type StatementLinesForm } from "./StatementLinesFields";

const FORM_FIELDS = ["fromDay", "toDay", "openingBalance", "closingBalance", "lines"] as const satisfies readonly (keyof BankStatementFormInput)[];

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
    defaultValues: { fromDay, toDay, openingBalance: openingBalance === undefined ? "" : String(openingBalance), closingBalance: "", lines: [] },
  });
  const [from, to, opening, closing, lines] = useWatch({ control, name: ["fromDay", "toDay", "openingBalance", "closingBalance", "lines"] });
  const openingValue = parseStatementAmount(opening);
  const closingValue = parseStatementAmount(closing);
  const gap = openingValue !== null && closingValue !== null && closing.trim() !== "" ? closingValue - openingValue - linesTotal(lines) : null;

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
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-card-lg border border-border bg-background p-4 md:p-6" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("form.fromDay")} required description={from ? formatCafeDayMedium(from, locale) : undefined} error={fieldError(errors.fromDay?.message)}>
          {(field) => <Input {...field} {...register("fromDay")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField label={t("form.toDay")} required description={to ? formatCafeDayMedium(to, locale) : undefined} error={fieldError(errors.toDay?.message)}>
          {(field) => <Input {...field} {...register("toDay")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField
          label={t("form.openingBalance")}
          required
          description={openingBalance === undefined ? t("form.openingHintFirst") : t("form.openingHint")}
          error={fieldError(errors.openingBalance?.message)}
        >
          {(field) => <Input {...field} {...register("openingBalance")} inputMode="numeric" dir="ltr" />}
        </TextField>
        <TextField label={t("form.closingBalance")} required description={t("form.closingHint")} error={fieldError(errors.closingBalance?.message)}>
          {(field) => <Input {...field} {...register("closingBalance")} inputMode="numeric" dir="ltr" />}
        </TextField>
      </div>

      <StatementLinesFields
        control={control as unknown as Control<StatementLinesForm>}
        register={register as unknown as UseFormRegister<StatementLinesForm>}
        errors={errors}
        defaultDay={to || today}
      />

      {gap !== null ? (
        <p className={gap === 0 ? "text-body-small text-success-foreground" : "text-body-small text-warning-foreground"} aria-live="polite">
          {gap === 0 ? t("form.addsUp") : t("form.gap", { amount: formatMoney(gap, locale) })}
        </p>
      ) : null}

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      <div className="flex gap-3">
        <Button type="submit" size="sm" loading={isSubmitting}>
          {t("form.submit")}
        </Button>
        <Button asChild type="button" size="sm" variant="ghost">
          <Link href="/dashboard/accounting/bank">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

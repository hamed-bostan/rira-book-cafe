"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { MAX_ENTRY_LINES, manualEntrySchema, type ManualEntryFormInput } from "@/src/contracts/accounting-schema";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Icon, Input, Select, TextField, useToast } from "@/src/presentation/design-system";

import { journalEntriesApi } from "./accounting-api";
import { accountLabel } from "./accounting-format";

const EMPTY_LINE = { accountCode: "", debit: "", credit: "", memo: "" };

/** A typed amount as a number for the running totals; anything unparseable counts as 0. */
function amountOf(value: string | undefined): number {
  return value && /^\d+$/.test(value.trim()) ? Number(value.trim()) : 0;
}

/**
 * A manual journal entry: date, description and two or more lines, each a debit
 * or a credit. Running totals show whether it balances before it's sent; the
 * server and the database refuse it if it doesn't.
 */
export function ManualEntryForm({ accounts, today }: { accounts: Account[]; today: string }) {
  const t = useTranslations("dashAccounting");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const active = accounts.filter((account) => account.isActive);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ManualEntryFormInput>({
    resolver: zodResolver(manualEntrySchema, undefined, { raw: true }),
    defaultValues: { date: today, description: "", lines: [EMPTY_LINE, EMPTY_LINE] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const date = useWatch({ control, name: "date" });

  const debits = lines.reduce((sum, line) => sum + amountOf(line.debit), 0);
  const credits = lines.reduce((sum, line) => sum + amountOf(line.credit), 0);
  const difference = debits - credits;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const entry = await journalEntriesApi.create(values);
      toast({ tone: "success", title: t("form.posted", { number: entry.number }) });
      router.push(`/dashboard/accounting/journal/${entry.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.date) {
        setError("date", { message: error.fieldErrors.date });
        return;
      }
      setError("root", { message: localizeApiError(error, tApiErrors, t("form.error")) });
    }
  });

  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[12rem_1fr]">
        <TextField
          label={t("form.dateLabel")}
          required
          description={date ? formatCafeDayMedium(date, locale) : undefined}
          error={fieldError(errors.date?.message)}
        >
          {(controlProps) => <Input {...controlProps} {...register("date")} type="date" max={today} dir="ltr" />}
        </TextField>
        <TextField label={t("form.descriptionLabel")} required error={fieldError(errors.description?.message)}>
          {(controlProps) => <Input {...controlProps} {...register("description")} dir="auto" placeholder={t("form.descriptionPlaceholder")} />}
        </TextField>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-body-small-emphasis text-input-foreground">{t("form.linesLabel")}</legend>
        {fields.map((field, index) => {
          const lineErrors = errors.lines?.[index];
          return (
            <div key={field.id} className="grid grid-cols-2 gap-2 rounded-card-md border border-border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-start md:border-0 md:p-0">
              <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
                <Select {...register(`lines.${index}.accountCode`)} aria-label={t("form.accountLabel")} className="h-10">
                  <option value="">{t("form.accountPlaceholder")}</option>
                  {active.map((account) => (
                    <option key={account.code} value={account.code}>
                      {accountLabel(account, locale)}
                    </option>
                  ))}
                </Select>
                {lineErrors?.accountCode?.message ? <FormMessage>{fieldError(lineErrors.accountCode.message)}</FormMessage> : null}
              </div>
              <div className="flex flex-col gap-1">
                <Input {...register(`lines.${index}.debit`)} inputMode="numeric" placeholder={t("form.debitLabel")} aria-label={t("form.debitLabel")} className="h-10" dir="ltr" />
                {lineErrors?.debit?.message ? <FormMessage>{fieldError(lineErrors.debit.message)}</FormMessage> : null}
              </div>
              <div className="flex flex-col gap-1">
                <Input {...register(`lines.${index}.credit`)} inputMode="numeric" placeholder={t("form.creditLabel")} aria-label={t("form.creditLabel")} className="h-10" dir="ltr" />
                {lineErrors?.credit?.message ? <FormMessage>{fieldError(lineErrors.credit.message)}</FormMessage> : null}
              </div>
              <Input {...register(`lines.${index}.memo`)} placeholder={t("form.memoLabel")} aria-label={t("form.memoLabel")} className="col-span-2 h-10 md:col-span-1" dir="auto" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="col-span-2 h-10 justify-self-end md:col-span-1"
                onClick={() => remove(index)}
                disabled={fields.length <= 2}
                aria-label={t("form.removeLine")}
              >
                <Icon icon={X} size="sm" />
              </Button>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => append(EMPTY_LINE)} disabled={fields.length >= MAX_ENTRY_LINES}>
            <Icon icon={Plus} size="sm" className="me-1.5" />
            {t("form.addLine")}
          </Button>
          <p className={difference === 0 && debits > 0 ? "text-body-small-emphasis text-success-foreground" : "text-body-small-emphasis text-muted-foreground"}>
            {t("form.totals", { debits: formatMoney(debits, locale), credits: formatMoney(credits, locale) })}
            {" · "}
            {difference === 0 ? t("form.balanced") : t("form.difference", { amount: formatMoney(Math.abs(difference), locale) })}
          </p>
        </div>
        {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
      </fieldset>

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={isSubmitting}>
          {t("form.post")}
        </Button>
        <Button asChild variant="outline" type="button">
          <Link href="/dashboard/accounting/journal">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { MAX_ENTRY_LINES, manualEntrySchema, type ManualEntryFormInput } from "@/src/contracts/accounting-schema";
import type { Account } from "@/src/domain/entities/Ledger";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { AMOUNT_INPUT, LINE_HEAD, LINE_ROW, PAGE_CARD, ROW_TEXT } from "../pageStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { journalEntriesApi } from "./accounting-api";
import { accountLabel } from "./accounting-format";

const EMPTY_LINE = { accountCode: "", debit: "", credit: "", memo: "" };

/** Account, debit and credit, memo and the remove button; on a phone the account and memo take their own rows. */
const LINE_COLUMNS =
  "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_8rem_8rem_minmax(0,1fr)_2.25rem]";

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
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <DashboardFormField
          label={t("form.dateLabel")}
          required
          hint={date ? formatCafeDayMedium(date, locale) : undefined}
          error={fieldError(errors.date?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("date")}
              size="control-md"
              type="date"
              max={today}
              dir="ltr"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("form.descriptionLabel")} required error={fieldError(errors.description?.message)}>
          {(field) => (
            <Input
              {...field}
              {...register("description")}
              size="control-md"
              dir="auto"
              placeholder={t("form.descriptionPlaceholder")}
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className={cn(FIELD_LABEL, "mb-3")}>{t("form.linesLabel")}</legend>
        <div aria-hidden className={cn(LINE_HEAD, "hidden gap-x-3 md:grid", LINE_COLUMNS)}>
          <span>{t("form.accountLabel")}</span>
          <span className="text-end">{t("form.debitLabel")}</span>
          <span className="text-end">{t("form.creditLabel")}</span>
          <span>{t("form.memoLabel")}</span>
          <span />
        </div>
        {fields.map((field, index) => {
          const lineErrors = errors.lines?.[index];
          return (
            <div key={field.id} className={cn(LINE_ROW, LINE_COLUMNS)}>
              <div className="col-span-full flex min-w-0 flex-col gap-1 md:col-span-1">
                <Select
                  {...register(`lines.${index}.accountCode`)}
                  size="control-md"
                  aria-label={t("form.accountLabel")}
                  className="border-border-strong"
                >
                  <option value="">{t("form.accountPlaceholder")}</option>
                  {active.map((account) => (
                    <option key={account.code} value={account.code}>
                      {accountLabel(account, locale)}
                    </option>
                  ))}
                </Select>
                {lineErrors?.accountCode?.message ? (
                  <FormMessage>{fieldError(lineErrors.accountCode.message)}</FormMessage>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Input
                  {...register(`lines.${index}.debit`)}
                  size="control-md"
                  inputMode="numeric"
                  placeholder={t("form.debitLabel")}
                  aria-label={t("form.debitLabel")}
                  inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT)}
                  dir="ltr"
                />
                {lineErrors?.debit?.message ? <FormMessage>{fieldError(lineErrors.debit.message)}</FormMessage> : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <Input
                  {...register(`lines.${index}.credit`)}
                  size="control-md"
                  inputMode="numeric"
                  placeholder={t("form.creditLabel")}
                  aria-label={t("form.creditLabel")}
                  inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT)}
                  dir="ltr"
                />
                {lineErrors?.credit?.message ? (
                  <FormMessage>{fieldError(lineErrors.credit.message)}</FormMessage>
                ) : null}
              </div>
              <Input
                {...register(`lines.${index}.memo`)}
                size="control-md"
                placeholder={t("form.memoLabel")}
                aria-label={t("form.memoLabel")}
                className="col-span-2 md:col-span-1"
                inputClassName={FIELD_INPUT}
                dir="auto"
              />
              <RemoveLineButton
                label={t("form.removeLine")}
                onClick={() => remove(index)}
                disabled={fields.length <= 2}
              />
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="px-3"
            onClick={() => append(EMPTY_LINE)}
            disabled={fields.length >= MAX_ENTRY_LINES}
          >
            <Icon icon={Plus} size="icon-md" className="me-2" />
            {t("form.addLine")}
          </Button>
          <div className={cn(ROW_TEXT, "flex flex-wrap items-center gap-x-3 gap-y-2")}>
            {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
            <span className="whitespace-nowrap text-foreground/80 tabular-nums">
              {t("form.totals", { debits: formatNumber(debits, locale), credits: formatNumber(credits, locale) })}
            </span>
            <Badge
              size="compact"
              appearance="outline"
              variant={difference !== 0 ? "warning" : debits > 0 ? "success" : "neutral"}
            >
              {difference === 0
                ? t("form.balanced")
                : t("form.difference", { amount: formatNumber(Math.abs(difference), locale) })}
            </Badge>
          </div>
        </div>
      </fieldset>

      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("form.post")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/accounting/journal">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

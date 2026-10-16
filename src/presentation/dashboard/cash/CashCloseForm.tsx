"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";

import { cashCloseSchema, type CashCloseFormInput } from "@/src/contracts/cash-schema";
import type { CashClose } from "@/src/domain/entities/CashClose";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { Button, FormMessage, Input, Textarea, TextField } from "@/src/presentation/design-system";

import { cashClosesApi } from "./cash-close-api";
import { DifferenceText } from "./DifferenceText";

const FORM_FIELDS = ["counted", "deposited", "note"] as const satisfies readonly (keyof CashCloseFormInput)[];

const wholeToman = (value: string): number | null => (/^\d+$/.test(value.trim()) ? Number(value) : null);

type CashCloseFormProps = {
  day: string;
  /** What the till should hold — shown to managers; absent for a blind count. */
  expected?: number;
};

/**
 * Count the till and close the day. A manager sees the expected amount and the
 * over/short as they type, and the server refuses the close if cash moved since
 * (so the count is never checked against a stale figure). Staff count blind and
 * see the result once the close is posted.
 */
export function CashCloseForm({ day, expected }: CashCloseFormProps) {
  const t = useTranslations("dashCash");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const [closed, setClosed] = React.useState<CashClose | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CashCloseFormInput>({
    resolver: zodResolver(cashCloseSchema, undefined, { raw: true }),
    defaultValues: { day, counted: "", deposited: "", note: "", expectedSeen: expected },
  });
  const [counted, deposited] = useWatch({ control, name: ["counted", "deposited"] });
  const countedValue = wholeToman(counted);
  const depositValue = wholeToman(deposited) ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const close = await cashClosesApi.create({ ...values, day, expectedSeen: expected });
      setClosed(close);
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
        // The books moved under a manager's count: show the new figure.
        if (error.code === "CASH_CHANGED") router.refresh();
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("form.error")) });
    }
  });

  if (closed) {
    return (
      <section className="flex flex-col gap-2 rounded-card-lg border border-border bg-background p-4 md:p-6" aria-live="polite">
        <h2 className="text-body-lead text-foreground">{t("form.closedHeading")}</h2>
        <p className="text-body-small text-muted-foreground">
          {t("form.closedSummary", { counted: formatMoney(closed.counted, locale), expected: formatMoney(closed.expected, locale) })}
        </p>
        <DifferenceText difference={closed.difference} className="text-body-strong" />
        {closed.deposited > 0 ? <p className="text-body-small text-muted-foreground">{t("form.depositedSummary", { amount: formatMoney(closed.deposited, locale) })}</p> : null}
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 md:p-6" noValidate>
      <div className="flex flex-col gap-1">
        <h2 className="text-body-lead text-foreground">{t("form.heading")}</h2>
        <p className="text-body-small text-muted-foreground">{expected === undefined ? t("form.blindHint") : t("form.hint")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={t("form.counted")} required description={t("form.countedHint")} error={fieldError(errors.counted?.message)}>
          {(field) => <Input {...field} {...register("counted")} inputMode="numeric" dir="ltr" autoComplete="off" />}
        </TextField>
        <TextField label={t("form.deposited")} description={t("form.depositedHint")} error={fieldError(errors.deposited?.message)}>
          {(field) => <Input {...field} {...register("deposited")} inputMode="numeric" dir="ltr" autoComplete="off" />}
        </TextField>
      </div>

      {countedValue !== null ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-card-md bg-surface px-4 py-3 text-body-small sm:grid-cols-2">
          {expected !== undefined ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{t("form.differenceLabel")}</dt>
              <dd>
                <DifferenceText difference={countedValue - expected} />
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{t("form.closingFloat")}</dt>
            <dd className="text-foreground">{formatMoney(countedValue - depositValue, locale)}</dd>
          </div>
        </dl>
      ) : null}

      <TextField label={t("form.note")} description={t("form.noteHint")} error={fieldError(errors.note?.message)}>
        {(field) => <Textarea {...field} {...register("note")} rows={2} maxLength={300} dir="auto" />}
      </TextField>

      {errors.root?.message ? <FormMessage size="md">{errors.root.message}</FormMessage> : null}
      <div>
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {t("form.submit")}
        </Button>
      </div>
    </form>
  );
}

"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import type { PayRunDraft } from "@/src/domain/entities/Payroll";
import { useRouter } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardField } from "../DashboardField";
import { DashboardSection } from "../DashboardSection";
import { expenseApiErrorMessage } from "../expenses/expenseApiErrorMessage";
import { normalizeAmount } from "../expenses/expenseFormat";
import { FIELD_HINT } from "../fieldStyles";
import { AMOUNT, AMOUNT_INPUT } from "../pageStyles";

import { payRunsApi } from "./payroll-api";
import { formatPayPeriod } from "./payrollFormat";

/**
 * Record a month's pay: one salary per person, starting from last month's (or their
 * usual one) so only what changed needs typing. The cafe pays no insurance and
 * withholds no tax, so a salary is what they're paid, and it's booked in one go on
 * saving.
 */
export function PayRunForm({ draft, today }: { draft: PayRunDraft; today: string }) {
  const t = useTranslations("dashPayroll");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [period, setPeriod] = React.useState(draft.periods[0]?.period ?? "");
  const [date, setDate] = React.useState(draft.periods[0]?.date ?? today);
  const [salaries, setSalaries] = React.useState(
    () => new Map(draft.lines.map((line) => [line.employeeId, line.gross ? String(line.gross) : ""])),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function setSalary(employeeId: string, value: string): void {
    setSalaries((current) => new Map(current).set(employeeId, value));
  }

  function choosePeriod(value: string): void {
    setPeriod(value);
    const chosen = draft.periods.find((option) => option.period === value);
    if (chosen) setDate(chosen.date);
  }

  const lines = draft.lines.map((line) => {
    const salary = salaries.get(line.employeeId) ?? "";
    const parsed = optionalMoneyField.safeParse(normalizeAmount(salary));
    const amount = parsed.success ? parsed.data : null;
    // Left out of the month: blank or nothing.
    return { line, salary, amount, leftOut: amount === 0 };
  });

  const included = lines.filter(({ leftOut }) => !leftOut);
  const total = included.reduce((sum, { amount }) => sum + (amount ?? 0), 0);
  const ready =
    period !== "" &&
    isCafeDay(date) &&
    date <= today &&
    included.length > 0 &&
    lines.every(({ amount }) => amount !== null);

  function submit(): void {
    setError(null);
    const month = formatPayPeriod(period, locale);
    startTransition(async () => {
      try {
        const run = await payRunsApi.create({
          period,
          date,
          lines: included.map(({ line, salary }) => ({ employeeId: line.employeeId, gross: normalizeAmount(salary) })),
        });
        toast({ tone: "success", title: t("form.saved", { month }) });
        router.push(`/dashboard/payroll/${run.id}`);
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("form.error")));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <DashboardSection title={t("form.monthLabel")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DashboardField label={t("form.monthLabel")}>
            <Select size="control-md" value={period} onChange={(event) => choosePeriod(event.target.value)}>
              {draft.periods.map((option) => (
                <option key={option.period} value={option.period}>
                  {formatPayPeriod(option.period, locale)}
                </option>
              ))}
            </Select>
          </DashboardField>
          <DashboardField label={t("form.dateLabel")} hint={t("form.dateHint")}>
            <Input
              size="control-md"
              type="date"
              value={date}
              max={today}
              onChange={(event) => setDate(event.target.value)}
              dir="ltr"
            />
          </DashboardField>
        </div>
      </DashboardSection>

      <DashboardSection title={t("form.peopleHeading")} description={t("form.peopleHint")} flush>
        <ul className="divide-y divide-border">
          {lines.map(({ line, salary, amount }) => (
            <li key={line.employeeId} className="flex flex-col gap-2 p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold text-foreground" dir="auto">
                    {line.employeeName}
                  </span>
                  {line.position ? (
                    <span className={FIELD_HINT} dir="auto">
                      {line.position}
                    </span>
                  ) : null}
                </span>
                <Input
                  size="control-md"
                  className="w-full sm:w-56"
                  value={salary}
                  onChange={(event) => setSalary(line.employeeId, event.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                  placeholder="0"
                  dir="ltr"
                  inputClassName={AMOUNT_INPUT}
                  aria-label={`${t("salaryLabel")}, ${line.employeeName}`}
                  aria-invalid={amount === null || undefined}
                />
              </div>
              {amount === null ? <FormMessage>{tFormErrors("amountInvalid")}</FormMessage> : null}
            </li>
          ))}
        </ul>
      </DashboardSection>

      <DashboardSection title={t("form.totalsHeading")} flush>
        <dl>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 bg-muted px-5 py-3 font-semibold">
            <dt className="text-foreground">{t("totalSalariesLabel")}</dt>
            <dd className={cn(AMOUNT, "text-foreground")}>{formatMoney(total, locale)}</dd>
          </div>
        </dl>
      </DashboardSection>

      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex justify-end">
        <Button type="button" size="control-md" className="px-4" disabled={!ready} loading={pending} onClick={submit}>
          {t("form.save")}
        </Button>
      </div>
    </div>
  );
}

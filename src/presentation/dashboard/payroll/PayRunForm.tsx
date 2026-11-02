"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { optionalMoneyField } from "@/src/contracts/money-fields";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { netPay, type PayRunDraft, type PayRunDraftLine } from "@/src/domain/entities/Payroll";
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

const FIGURES = ["gross", "employeeInsurance", "incomeTax", "employerInsurance"] as const;
type Figure = (typeof FIGURES)[number];
type Row = Record<Figure, string>;

const LABEL: Record<Figure, "grossLabel" | "employeeInsuranceLabel" | "incomeTaxLabel" | "employerInsuranceLabel"> = {
  gross: "grossLabel",
  employeeInsurance: "employeeInsuranceLabel",
  incomeTax: "incomeTaxLabel",
  employerInsurance: "employerInsuranceLabel",
};

const toRow = (line: PayRunDraftLine): Row => ({
  gross: line.gross ? String(line.gross) : "",
  employeeInsurance: line.employeeInsurance ? String(line.employeeInsurance) : "",
  incomeTax: line.incomeTax ? String(line.incomeTax) : "",
  employerInsurance: line.employerInsurance ? String(line.employerInsurance) : "",
});

/** A row as whole Toman, or `null` while something in it isn't a number. */
function parseRow(row: Row): Record<Figure, number> | null {
  const parsed = FIGURES.map((figure) => optionalMoneyField.safeParse(normalizeAmount(row[figure])));
  if (!parsed.every((result) => result.success)) return null;
  const [gross, employeeInsurance, incomeTax, employerInsurance] = parsed.map((result) => result.data ?? 0);
  return { gross, employeeInsurance, incomeTax, employerInsurance };
}

/**
 * Record a month's pay: the figures from the accountant's sheet, one person at a
 * time, starting from last month's so only what changed needs typing. Net pay and the
 * month's totals show as they're entered, and it's booked in one go on saving.
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
  const [rows, setRows] = React.useState(() => new Map(draft.lines.map((line) => [line.employeeId, toRow(line)])));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function setFigure(employeeId: string, figure: Figure, value: string): void {
    setRows((current) => {
      const next = new Map(current);
      const row = next.get(employeeId);
      if (row) next.set(employeeId, { ...row, [figure]: value });
      return next;
    });
  }

  function choosePeriod(value: string): void {
    setPeriod(value);
    const chosen = draft.periods.find((option) => option.period === value);
    if (chosen) setDate(chosen.date);
  }

  const lines = draft.lines.map((line) => {
    const row = rows.get(line.employeeId) ?? toRow(line);
    const figures = parseRow(row);
    const blank = FIGURES.every((figure) => row[figure].trim() === "");
    const left = figures ? figures.employeeInsurance + figures.incomeTax + figures.employerInsurance : 0;
    return {
      line,
      row,
      figures,
      // Left out of the month: a person with no gross and nothing else typed.
      leftOut: blank || (figures?.gross === 0 && left === 0),
      invalid: !figures || (!blank && figures.gross === 0 && left > 0) || netPay(figures) < 0,
    };
  });

  const included = lines.filter(({ leftOut }) => !leftOut);
  const totals = included.reduce(
    (sum, { figures }) => ({
      gross: sum.gross + (figures?.gross ?? 0),
      net: sum.net + (figures ? netPay(figures) : 0),
      insurance: sum.insurance + (figures?.employeeInsurance ?? 0) + (figures?.employerInsurance ?? 0),
      tax: sum.tax + (figures?.incomeTax ?? 0),
      cost: sum.cost + (figures?.gross ?? 0) + (figures?.employerInsurance ?? 0),
    }),
    { gross: 0, net: 0, insurance: 0, tax: 0, cost: 0 },
  );
  const ready =
    period !== "" && isCafeDay(date) && date <= today && included.length > 0 && !lines.some(({ invalid }) => invalid);

  function submit(): void {
    setError(null);
    const month = formatPayPeriod(period, locale);
    startTransition(async () => {
      try {
        const run = await payRunsApi.create({
          period,
          date,
          lines: included.map(({ line, row }) => ({
            employeeId: line.employeeId,
            gross: normalizeAmount(row.gross),
            employeeInsurance: normalizeAmount(row.employeeInsurance),
            incomeTax: normalizeAmount(row.incomeTax),
            employerInsurance: normalizeAmount(row.employerInsurance),
          })),
        });
        toast({ tone: "success", title: t("form.saved", { month }) });
        router.push(`/dashboard/payroll/${run.id}`);
      } catch (err) {
        setError(expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("form.error")));
      }
    });
  }

  const summary = [
    { key: "totalGross", amount: totals.gross },
    { key: "totalNet", amount: totals.net },
    { key: "totalInsurance", amount: totals.insurance },
    { key: "totalTax", amount: totals.tax },
    { key: "totalCost", amount: totals.cost, strong: true },
  ] as const;

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
          {lines.map(({ line, row, figures, invalid, leftOut }) => (
            <li key={line.employeeId} className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground" dir="auto">
                    {line.employeeName}
                  </span>
                  {line.position ? (
                    <span className={FIELD_HINT} dir="auto">
                      {line.position}
                    </span>
                  ) : null}
                </span>
                {!leftOut && figures && !invalid ? (
                  <span className={cn(AMOUNT, "font-semibold text-foreground")}>
                    {t("form.netFor", { amount: formatMoney(netPay(figures), locale) })}
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {FIGURES.map((figure) => (
                  <DashboardField key={figure} label={t(LABEL[figure])}>
                    <Input
                      size="control-md"
                      value={row[figure]}
                      onChange={(event) => setFigure(line.employeeId, figure, event.target.value)}
                      autoComplete="off"
                      inputMode="numeric"
                      placeholder="0"
                      dir="ltr"
                      inputClassName={AMOUNT_INPUT}
                      aria-label={`${t(LABEL[figure])}, ${line.employeeName}`}
                    />
                  </DashboardField>
                ))}
              </div>
              {invalid ? (
                <FormMessage>{figures ? t("form.deductionsTooHigh") : tFormErrors("amountInvalid")}</FormMessage>
              ) : null}
            </li>
          ))}
        </ul>
      </DashboardSection>

      <DashboardSection title={t("form.totalsHeading")} flush>
        <dl className="divide-y divide-border">
          {summary.map((row) => (
            <div
              key={row.key}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-3",
                "strong" in row && "bg-muted font-semibold",
              )}
            >
              <dt className="text-foreground">{t(`form.${row.key}`)}</dt>
              <dd className={cn(AMOUNT, "text-foreground")}>{formatMoney(row.amount, locale)}</dd>
            </div>
          ))}
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

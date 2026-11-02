import { getLocale, getTranslations } from "next-intl/server";

import { netPay, payRunOwed, payRunTotals, type PayRunLine } from "@/src/domain/entities/Payroll";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { entryTotal } from "@/src/presentation/dashboard/accounting/accounting-format";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { DashboardSection } from "../DashboardSection";
import { ExpenseStatusBadge } from "../expenses/ExpenseStatusBadge";
import { AMOUNT, ROW_CAPTION, TABLE_HEAD, TABLE_TD, TABLE_TH } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { formatPayPeriod } from "./payrollFormat";
import { PayRunActions } from "./PayRunActions";

import type { PayRunDetailWire } from "./payroll-response-schema";

type PayRunScreenProps = PayRunDetailWire & { today: string };

/** One figure across the people table: its heading, each person's value, and the total. */
type FigureColumn = {
  key: string;
  label: string;
  figure: (line: PayRunLine) => number;
  total: number;
  strong?: boolean;
};

/** One month's pay: who got what, how it was paid, and the journal entries behind it. */
export async function PayRunScreen({ run, entries, today }: PayRunScreenProps) {
  const t = await getTranslations("dashPayroll");
  const tAccounting = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const month = formatPayPeriod(run.period, locale);
  const totals = payRunTotals(run.lines);
  const owed = payRunOwed(run);

  const payment =
    run.paidFrom && run.paidOn
      ? t("detail.paidFrom", {
          source: t(`detail.from.${run.paidFrom}`),
          date: formatCafeDayMedium(run.paidOn, locale),
        })
      : run.paidAmount > 0
        ? t("detail.paidSoFar", { paid: formatMoney(run.paidAmount, locale), left: formatMoney(owed, locale) })
        : t("detail.unpaid");

  // The form records a salary alone, as the cafe pays no insurance and withholds no
  // tax. A run that has deductions anyway (from the API) still shows every figure.
  const hasDeductions = totals.employeeInsurance + totals.incomeTax + totals.employerInsurance > 0;

  const details = [
    { key: "date", label: t("detail.bookedOn"), value: formatCafeDayMedium(run.date, locale) },
    { key: "payment", label: t("detail.payment"), value: payment },
    {
      key: "net",
      label: hasDeductions ? t("netLabel") : t("totalSalariesLabel"),
      value: formatMoney(totals.net, locale),
    },
  ];

  const columns: FigureColumn[] = hasDeductions
    ? [
        { key: "gross", label: t("grossLabel"), figure: (line) => line.gross, total: totals.gross },
        {
          key: "employeeInsurance",
          label: t("employeeInsuranceLabel"),
          figure: (line) => line.employeeInsurance,
          total: totals.employeeInsurance,
        },
        { key: "incomeTax", label: t("incomeTaxLabel"), figure: (line) => line.incomeTax, total: totals.incomeTax },
        { key: "net", label: t("netLabel"), figure: netPay, total: totals.net, strong: true },
        {
          key: "employerInsurance",
          label: t("employerInsuranceLabel"),
          figure: (line) => line.employerInsurance,
          total: totals.employerInsurance,
        },
      ]
    : [{ key: "gross", label: t("salaryLabel"), figure: (line) => line.gross, total: totals.gross }];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={month} />
      <DashboardPageHeader
        backHref="/dashboard/payroll"
        backLabel={t("heading")}
        title={t("detail.title", { month })}
        badge={<ExpenseStatusBadge status={run.status} standalone />}
        subtitle={t("detail.recordedBy", { name: run.createdByName })}
        actions={
          run.status !== "void" ? (
            <PayRunActions id={run.id} month={month} date={run.date} owed={owed} today={today} />
          ) : undefined
        }
      />

      <DashboardSection title={month} flush>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-5 p-5 sm:grid-cols-3">
          {details.map((detail) => (
            <div key={detail.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className={ROW_CAPTION}>{detail.label}</dt>
              <dd className="font-medium text-foreground">{detail.value}</dd>
            </div>
          ))}
        </dl>
      </DashboardSection>

      <DashboardSection title={t("detail.linesHeading")} className="overflow-hidden" flush>
        <div className="overflow-x-auto">
          <table className={cn("w-full", hasDeductions && "min-w-3xl")}>
            <thead className={TABLE_HEAD}>
              <tr>
                <th scope="col" className={TABLE_TH}>
                  {t("staff.nameLabel")}
                </th>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className={cn(TABLE_TH, "text-end")}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {run.lines.map((line) => (
                <tr key={line.employeeId}>
                  <td className={TABLE_TD} dir="auto">
                    {line.employeeName}
                  </td>
                  {columns.map((column) => (
                    <td key={column.key} className={cn(TABLE_TD, AMOUNT, column.strong && "font-semibold")}>
                      {formatNumber(column.figure(line), locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border bg-muted font-semibold">
              <tr>
                <th scope="row" className={cn(TABLE_TD, "text-start font-semibold")}>
                  {t("detail.totals")}
                </th>
                {columns.map((column) => (
                  <td key={column.key} className={cn(TABLE_TD, AMOUNT)}>
                    {formatNumber(column.total, locale)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </DashboardSection>

      {run.status !== "void" && hasDeductions ? (
        <p className={ROW_CAPTION}>
          {t("detail.settleHint")}{" "}
          <Link href="/dashboard/accounting/journal/new" className="font-medium text-primary hover:text-primary-hover">
            {t("detail.newEntry")}
          </Link>
        </p>
      ) : null}

      <DashboardSection title={t("detail.entriesHeading")} className="overflow-hidden" flush>
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="flex min-w-48 flex-1 flex-col gap-0.5">
                <Link
                  href={`/dashboard/accounting/journal/${entry.id}`}
                  className="-my-3 w-fit py-3 font-medium text-primary hover:text-primary-hover sm:my-0 sm:py-0"
                >
                  JE-{entry.number}
                </Link>
                <span className={ROW_CAPTION}>{formatCafeDayMedium(entry.date, locale)}</span>
              </span>
              <Badge size="compact" variant="neutral" appearance="outline">
                {tAccounting(`source.${entry.source}`)}
              </Badge>
              <span className={cn(AMOUNT, "min-w-28 font-semibold text-foreground")}>
                {formatMoney(entryTotal(entry), locale)}
              </span>
            </li>
          ))}
        </ul>
      </DashboardSection>
    </div>
  );
}

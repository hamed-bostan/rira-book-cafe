import { getLocale, getTranslations } from "next-intl/server";

import type { VatReport } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";

import { AMOUNT, PAGE_CARD, ROW_CAPTION, ROW_TEXT } from "../pageStyles";

import { StatementHeader } from "./StatementHeader";

/**
 * The period's VAT return: VAT collected inside sales, less VAT paid on bills,
 * is what the period adds to the debt to the tax office; payments made against it
 * are posted as manual entries (Dr VAT payable, Cr bank).
 */
export async function VatReportScreen({ report, canWrite }: { report: VatReport; canWrite: boolean }) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();

  const rows = [
    { key: "output", amount: report.outputVat },
    { key: "input", amount: -report.inputVat },
    { key: "net", amount: report.netForPeriod, strong: true },
    { key: "settled", amount: report.settled },
    { key: "closing", amount: report.closingBalance, strong: true },
  ] as const;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StatementHeader title={t("statements.vat.title")} subtitle={t("statements.vat.subtitle")} span={report} />
      <dl className={cn(PAGE_CARD, ROW_TEXT, "divide-y divide-border overflow-hidden")}>
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4 px-5 py-4",
              "strong" in row && "bg-muted font-semibold",
            )}
          >
            <dt className="flex min-w-0 flex-col gap-0.5">
              <span className="text-foreground">{t(`vat.${row.key}`)}</span>
              <span className={cn(ROW_CAPTION, "font-normal")}>{t(`vat.${row.key}Hint`)}</span>
            </dt>
            <dd className={cn(AMOUNT, "text-foreground")}>{formatNumber(row.amount, locale)}</dd>
          </div>
        ))}
      </dl>
      {canWrite && report.closingBalance > 0 ? (
        <p className={ROW_CAPTION}>
          {t("vat.settleHint")}{" "}
          <Link href="/dashboard/accounting/journal/new" className="font-medium text-primary hover:text-primary-hover">
            {t("journal.newEntry")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

import { getLocale, getTranslations } from "next-intl/server";

import type { VatReport } from "@/src/domain/entities/AccountingReports";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";

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
      <dl className="divide-y divide-border overflow-hidden rounded-card-lg border border-border bg-background text-body-small">
        {rows.map((row) => (
          <div
            key={row.key}
            className={
              "strong" in row
                ? "flex items-center justify-between gap-3 bg-surface px-4 py-3 text-body-small-emphasis"
                : "flex items-center justify-between gap-3 px-4 py-3"
            }
          >
            <dt className="flex flex-col">
              <span className="text-foreground">{t(`vat.${row.key}`)}</span>
              <span className="text-body-caption text-muted-foreground">{t(`vat.${row.key}Hint`)}</span>
            </dt>
            <dd className="whitespace-nowrap text-foreground">{formatMoney(row.amount, locale)}</dd>
          </div>
        ))}
      </dl>
      {canWrite && report.closingBalance > 0 ? (
        <p className="text-body-small text-muted-foreground">
          {t("vat.settleHint")}{" "}
          <Link
            href="/dashboard/accounting/journal/new"
            className="font-medium text-primary underline underline-offset-4"
          >
            {t("journal.newEntry")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

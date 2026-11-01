import { getLocale, getTranslations } from "next-intl/server";

import { cn } from "@/src/lib/utils";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { PAGE_CARD } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { accountingExports } from "./accounting-api";
import { statementSpanParams, type StatementSlug } from "./accounting-format";
import { AsOfPicker } from "./AsOfPicker";
import { ExportCsvLink } from "./ExportCsvLink";
import { PeriodPicker } from "./PeriodPicker";

type StatementHeaderProps = {
  slug: StatementSlug;
  /** A period statement (P&L, VAT, margins) or a point-in-time one (trial balance, balance sheet). */
  span: { fromDay: string; toDay: string } | { asOfDay: string };
};

/** The way back to the statements, the title, the export, and the period or as-of picker. */
export async function StatementHeader({ slug, span }: StatementHeaderProps) {
  const t = await getTranslations("dashAccounting");
  const locale = await getLocale();
  const title = t(`statements.${slug}.title`);

  return (
    <>
      <DashboardPageCrumb label={title} />
      <DashboardPageHeader
        backHref="/dashboard/accounting/statements"
        backLabel={t("statements.heading")}
        title={title}
        subtitle={t(`statements.${slug}.subtitle`)}
        actions={
          <ExportCsvLink href={accountingExports.statementHref(slug, { ...statementSpanParams(span), locale })} />
        }
      />
      <div className={cn(PAGE_CARD, "px-5 py-4")}>
        {"asOfDay" in span ? (
          <AsOfPicker asOfDay={span.asOfDay} />
        ) : (
          <PeriodPicker fromDay={span.fromDay} toDay={span.toDay} />
        )}
      </div>
    </>
  );
}

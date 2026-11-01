import { getTranslations } from "next-intl/server";

import { cn } from "@/src/lib/utils";

import { DashboardPageHeader } from "../DashboardPageHeader";
import { PAGE_CARD } from "../pageStyles";
import { DashboardPageCrumb } from "../shell/DashboardPageCrumb";

import { AsOfPicker } from "./AsOfPicker";
import { PeriodPicker } from "./PeriodPicker";

type StatementHeaderProps = {
  title: string;
  subtitle: string;
  /** A period statement (P&L, VAT, margins) or a point-in-time one (trial balance, balance sheet). */
  span: { fromDay: string; toDay: string } | { asOfDay: string };
};

/** The way back to the statements, the title, and the period or as-of picker. */
export async function StatementHeader({ title, subtitle, span }: StatementHeaderProps) {
  const t = await getTranslations("dashAccounting");

  return (
    <>
      <DashboardPageCrumb label={title} />
      <DashboardPageHeader
        backHref="/dashboard/accounting/statements"
        backLabel={t("statements.heading")}
        title={title}
        subtitle={subtitle}
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

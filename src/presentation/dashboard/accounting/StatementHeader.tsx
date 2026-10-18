import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/src/i18n/navigation";

import { AsOfPicker } from "./AsOfPicker";
import { PeriodPicker } from "./PeriodPicker";

type StatementHeaderProps = {
  title: string;
  subtitle: string;
  /** A period statement (P&L, VAT, margins) or a point-in-time one (trial balance, balance sheet). */
  span: { fromDay: string; toDay: string } | { asOfDay: string };
};

/** Breadcrumb back to the statements, the title, and the period or as-of picker. */
export async function StatementHeader({ title, subtitle, span }: StatementHeaderProps) {
  const t = await getTranslations("dashAccounting");

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-2 text-body-caption text-muted-foreground"
      >
        <Link href="/dashboard/accounting/statements" className="hover:text-foreground">
          {t("statements.heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{title}</span>
      </nav>
      <div>
        <h1 className="dashboard-page-title">{title}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{subtitle}</p>
      </div>
      <div className="rounded-card-lg border border-border bg-background p-4 md:p-6">
        {"asOfDay" in span ? (
          <AsOfPicker asOfDay={span.asOfDay} />
        ) : (
          <PeriodPicker fromDay={span.fromDay} toDay={span.toDay} />
        )}
      </div>
    </div>
  );
}

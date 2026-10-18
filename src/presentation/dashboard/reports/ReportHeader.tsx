import { ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { AnalyticsRangePreset } from "@/src/domain/entities/Analytics";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";

import { ReportRangePicker } from "./ReportRangePicker";

type ReportHeaderProps = {
  title: string;
  subtitle: string;
  range: { fromDay: string; toDay: string };
  /** The period compared against, when the report compares. */
  previousRange?: { fromDay: string; toDay: string };
  selected: AnalyticsRangePreset | "custom";
  keep?: Record<string, string>;
};

/** Breadcrumb back to the reports directory, the title, the range picker and what's being compared. */
export async function ReportHeader({ title, subtitle, range, previousRange, selected, keep = {} }: ReportHeaderProps) {
  const t = await getTranslations("dashReports");
  const locale = await getLocale();

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label={t("breadcrumbLabel")}
        className="flex items-center gap-2 text-body-caption text-muted-foreground"
      >
        <Link href="/dashboard/reports" className="hover:text-foreground">
          {t("heading")}
        </Link>
        <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
        <span className="font-medium text-foreground">{title}</span>
      </nav>
      <div>
        <h1 className="dashboard-page-title">{title}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{subtitle}</p>
      </div>
      <ReportRangePicker selected={selected} fromDay={range.fromDay} toDay={range.toDay} keep={keep} />
      <p className="text-body-caption text-muted-foreground">
        {t("rangeCaption", {
          from: formatCafeDayMedium(range.fromDay, locale),
          to: formatCafeDayMedium(range.toDay, locale),
        })}
        {previousRange
          ? ` · ${t("comparedWith", {
              from: formatCafeDayMedium(previousRange.fromDay, locale),
              to: formatCafeDayMedium(previousRange.toDay, locale),
            })}`
          : null}
      </p>
    </div>
  );
}

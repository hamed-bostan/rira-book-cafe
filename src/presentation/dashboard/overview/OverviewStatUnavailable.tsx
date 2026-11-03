import { getTranslations } from "next-intl/server";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { OVERVIEW_STAT_CARD } from "./OverviewStat";
import { RetryReadButton } from "./RetryReadButton";

import type { LucideIcon } from "lucide-react";

type OverviewStatUnavailableProps = {
  label: string;
  icon: LucideIcon;
  className?: string;
};

/**
 * A headline card whose number couldn't be read. It keeps its place and its
 * label, so the row doesn't shift; a dash stands in for the figure, and a retry
 * for the link — a button can't sit inside the link the card otherwise is.
 */
export async function OverviewStatUnavailable({ label, icon, className }: OverviewStatUnavailableProps) {
  const t = await getTranslations("dashOverview");

  return (
    <div className={cn(OVERVIEW_STAT_CARD, className)}>
      <span className="flex items-center justify-between gap-3">
        <span className="text-body-default font-medium sm:text-body-small">{label}</span>
        <Icon icon={icon} size="icon-md" className="text-muted-foreground" />
      </span>
      <span className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <span className="flex flex-col gap-1">
          <span
            aria-hidden
            className="text-heading-subsection tracking-tight text-muted-foreground sm:text-heading-section"
          >
            —
          </span>
          <span className="text-body-small text-muted-foreground sm:text-body-caption">{t("statUnavailable")}</span>
        </span>
        <RetryReadButton />
      </span>
    </div>
  );
}

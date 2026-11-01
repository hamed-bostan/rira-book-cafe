import { DashboardBackLink } from "./DashboardBackLink";

import type { ReactNode } from "react";

type DashboardPageHeaderProps = {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle: string;
  /** Sits beside the title (an order's status). */
  badge?: ReactNode;
  /** The page's buttons, at the inline-end from the width where they fit beside the title. */
  actions?: ReactNode;
  /** What's wrong with the page as a whole, under the title. */
  alert?: ReactNode;
};

/** The top of a full page reached from a list: the way back, the title, and what can be done here. */
export function DashboardPageHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  badge,
  actions,
  alert,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <DashboardBackLink href={backHref}>{backLabel}</DashboardBackLink>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="dashboard-page-title">{title}</h1>
            {badge}
          </div>
          <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{subtitle}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2 print:hidden">{actions}</div> : null}
      </div>
      {alert}
    </div>
  );
}

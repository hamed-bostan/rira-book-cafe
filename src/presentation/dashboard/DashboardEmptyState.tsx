import { cn } from "@/src/lib/utils";

import type { ReactNode } from "react";

type DashboardEmptyStateProps = {
  title: string;
  body: string;
  /** A way out, when there is one ("Clear filters"). */
  action?: ReactNode;
  className?: string;
};

/**
 * What a redesigned list shows when it has nothing to show: a short title and a
 * line saying why — no artwork, so it reads as an answer rather than an error.
 */
export function DashboardEmptyState({ title, body, action, className }: DashboardEmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1 px-5 py-12 text-center", className)}>
      <p className="text-body-strong text-foreground sm:text-body-small-strong">{title}</p>
      <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{body}</p>
      {action ? <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

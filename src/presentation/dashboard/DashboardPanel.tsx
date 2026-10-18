import { cn } from "@/src/lib/utils";

import type { HTMLAttributes, ReactNode } from "react";

type DashboardPanelProps = HTMLAttributes<HTMLElement>;

type DashboardPanelHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  action?: ReactNode;
};

/** Shared overview-card surface and responsive inset. */
export function DashboardPanel({ className, ...props }: DashboardPanelProps) {
  return (
    <section className={cn("rounded-card-lg border border-border bg-background p-4 sm:p-5", className)} {...props} />
  );
}

/** Keeps panel titles and their optional actions aligned consistently. */
export function DashboardPanelHeader({ title, action, className, ...props }: DashboardPanelHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)} {...props}>
      <h2 className="text-body-lead text-foreground">{title}</h2>
      {action}
    </div>
  );
}

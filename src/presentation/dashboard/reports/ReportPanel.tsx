import { cn } from "@/src/lib/utils";

import type { ReactNode } from "react";

type ReportPanelProps = {
  title: string;
  /** One line under the title saying what the panel counts. */
  description?: string;
  /** A control at the header's end, such as a ranking switch. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** A titled card on a report, with an optional line under the title and a control at its end. */
export function ReportPanel({ title, description, action, children, className }: ReportPanelProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-5 rounded-card-lg border border-border bg-background p-5 shadow-xs",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-body-strong text-foreground">{title}</h2>
          {description ? (
            <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

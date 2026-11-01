import { cn } from "@/src/lib/utils";

import { FIELD_HINT } from "./fieldStyles";

import type { ReactNode } from "react";

type DashboardSectionProps = {
  title: ReactNode;
  /** A line under the title. */
  description?: string;
  /** A short note at the title's inline-end ("3 items"). */
  aside?: ReactNode;
  /** The content draws its own inset, as a list of rows does. */
  flush?: boolean;
  className?: string;
  children: ReactNode;
};

/** A titled card on a full page: a ruled header, then its fields or rows. */
export function DashboardSection({
  title,
  description,
  aside,
  flush = false,
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-card-lg border border-border bg-background text-body-default text-foreground shadow-xs sm:text-body-small",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-5 py-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-body-strong text-foreground">{title}</h2>
          {description ? <p className={FIELD_HINT}>{description}</p> : null}
        </div>
        {aside ? <span className={cn(FIELD_HINT, "tabular-nums")}>{aside}</span> : null}
      </div>
      {flush ? children : <div className="flex flex-col gap-4 p-5">{children}</div>}
    </section>
  );
}

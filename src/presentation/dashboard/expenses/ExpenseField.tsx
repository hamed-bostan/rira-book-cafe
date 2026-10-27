import { cn } from "@/src/lib/utils";

import type { ReactNode } from "react";

type ExpenseFieldProps = {
  label: string;
  /** A line under the control saying what goes in it. */
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** A labelled control in an Expenses dialog, with an optional hint under it. */
export function ExpenseField({ label, hint, className, children }: ExpenseFieldProps) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5 text-body-small-emphasis text-foreground", className)}>
      {label}
      {children}
      {hint ? (
        <span className="text-body-small font-normal text-pretty text-muted-foreground sm:text-body-caption">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

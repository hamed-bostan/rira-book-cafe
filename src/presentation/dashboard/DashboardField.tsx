import { cn } from "@/src/lib/utils";

import { FIELD_HINT, FIELD_LABEL } from "./fieldStyles";

import type { ReactNode } from "react";

type DashboardFieldProps = {
  label: string;
  /** A line under the control saying what goes in it. */
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** A labelled control in a redesigned dashboard form, with an optional hint under it. */
export function DashboardField({ label, hint, className, children }: DashboardFieldProps) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className={FIELD_LABEL}>{label}</span>
      {children}
      {hint ? <span className={FIELD_HINT}>{hint}</span> : null}
    </label>
  );
}

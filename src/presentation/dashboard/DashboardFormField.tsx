"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { RequiredMark } from "@/src/presentation/design-system/components/form/shared/RequiredMark";
import type { FieldControlProps } from "@/src/presentation/design-system/components/form/TextField/TextField";

import { FIELD_ERROR, FIELD_HINT, FIELD_LABEL } from "./fieldStyles";

type DashboardFormFieldProps = {
  label: string;
  /** A line under the control saying what goes in it (it may carry a link). */
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  /** Receives the wiring to spread onto the control. */
  children: (control: FieldControlProps) => React.ReactNode;
};

/**
 * A validated field on a full-page dashboard form. `DashboardField` with what a
 * React Hook Form control needs on top: the required mark, the error under the
 * control, and the ids that tie the two to it.
 */
export function DashboardFormField({ label, hint, error, required, className, children }: DashboardFormFieldProps) {
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children({
        id,
        "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": Boolean(error),
        required,
      })}
      {hint ? (
        <p id={hintId} className={FIELD_HINT}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <FormMessage id={errorId} className={FIELD_ERROR}>
          {error}
        </FormMessage>
      ) : null}
    </div>
  );
}

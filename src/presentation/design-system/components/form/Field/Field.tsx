"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";

import { FormMessage } from "../FormMessage";

export type FieldProps = {
  id?: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: (args: { id: string; ariaDescribedBy?: string; ariaInvalid?: boolean }) => React.ReactNode;
};

export const Field = ({ id, description, error, className, children }: FieldProps) => {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  const descriptionId = description ? `${fieldId}-desc` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  const ariaDescribedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {children({ id: fieldId, ariaDescribedBy, ariaInvalid: Boolean(error) })}

      {description && (
        <FormMessage id={descriptionId} tone="hint">
          {description}
        </FormMessage>
      )}

      {error && <FormMessage id={errorId}>{error}</FormMessage>}
    </div>
  );
};

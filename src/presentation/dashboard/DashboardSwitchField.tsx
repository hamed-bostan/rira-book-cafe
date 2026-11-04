"use client";

import * as React from "react";

import { cn } from "@/src/lib/utils";
import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";

import { FIELD_HINT, FIELD_LABEL } from "./fieldStyles";

type DashboardSwitchFieldProps = {
  label: string;
  hint?: string;
  /** The switch's name for assistive tech, when it says more than the label. */
  ariaLabel?: string;
  checked?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Can't be moved right now (e.g. nothing to switch on). */
  disabled?: boolean;
};

/**
 * A setting on a full-page form: the small switch, then what it does. The whole
 * row toggles it, so a phone's 44px reaches past the switch's 20.
 */
export function DashboardSwitchField({
  label,
  hint,
  ariaLabel,
  checked,
  onCheckedChange,
  disabled,
}: DashboardSwitchFieldProps) {
  const id = React.useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-11 items-start gap-3 sm:min-h-8",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
      )}
    >
      <Switch
        id={id}
        size="sm"
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
        disabled={disabled}
      />
      <span className="flex min-w-0 flex-col">
        <span className={FIELD_LABEL}>{label}</span>
        {hint ? <span className={FIELD_HINT}>{hint}</span> : null}
      </span>
    </label>
  );
}

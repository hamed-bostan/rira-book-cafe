"use client";

import * as React from "react";

import { Switch } from "@/src/presentation/design-system/components/Switch/Switch";

import { FIELD_HINT, FIELD_LABEL } from "./fieldStyles";

type DashboardSwitchFieldProps = {
  label: string;
  hint?: string;
  /** The switch's name for assistive tech, when it says more than the label. */
  ariaLabel?: string;
  checked?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * A setting on a full-page form: the small switch, then what it does. The whole
 * row toggles it, so a phone's 44px reaches past the switch's 20.
 */
export function DashboardSwitchField({ label, hint, ariaLabel, checked, onCheckedChange }: DashboardSwitchFieldProps) {
  const id = React.useId();

  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 sm:min-h-8">
      <Switch
        id={id}
        size="sm"
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
      <span className="flex min-w-0 flex-col">
        <span className={FIELD_LABEL}>{label}</span>
        {hint ? <span className={FIELD_HINT}>{hint}</span> : null}
      </span>
    </label>
  );
}

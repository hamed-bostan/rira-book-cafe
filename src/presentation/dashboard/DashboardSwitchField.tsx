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

/** A setting on a full-page form: the small switch, then what it does, which toggles it too. */
export function DashboardSwitchField({ label, hint, ariaLabel, checked, onCheckedChange }: DashboardSwitchFieldProps) {
  const id = React.useId();

  return (
    <div className="flex min-h-11 items-start gap-3 sm:min-h-8">
      <Switch
        id={id}
        size="sm"
        className="mt-0.5"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={ariaLabel}
      />
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col">
        <span className={FIELD_LABEL}>{label}</span>
        {hint ? <span className={FIELD_HINT}>{hint}</span> : null}
      </label>
    </div>
  );
}

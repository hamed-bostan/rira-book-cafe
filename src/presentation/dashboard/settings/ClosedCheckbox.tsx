"use client";

import * as React from "react";

import { Checkbox } from "@/src/presentation/design-system/components/Checkbox/Checkbox";

import { FIELD_LABEL } from "../fieldStyles";

type ClosedCheckboxProps = {
  label: string;
  /** What it closes, for assistive tech ("Closed on Friday"). */
  ariaLabel: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** "Closed" for one day of the hours: the whole label toggles it, 44px to the touch on a phone. */
export function ClosedCheckbox({ label, ariaLabel, checked, onCheckedChange }: ClosedCheckboxProps) {
  const id = React.useId();

  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2 sm:min-h-9">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        aria-label={ariaLabel}
      />
      <span className={FIELD_LABEL}>{label}</span>
    </label>
  );
}

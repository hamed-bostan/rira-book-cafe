"use client";

import { Check, Minus } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRingOffset } from "../shared/focusRing";

export type CheckboxProps = React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/**
 * Boolean selection control built on Radix Checkbox. Controlled (`checked` +
 * `onCheckedChange`) or uncontrolled (`defaultChecked`), keyboard-operable, and
 * labelable via `<label htmlFor>` or `aria-label`.
 *
 * Distinct from {@link Switch}, which is not a spelling choice: a switch takes
 * effect the moment it moves, so it belongs on a setting. A checkbox marks
 * something for an action taken later — which is exactly what selecting table rows
 * for a bulk action is, and why the row controls are these and the product form's
 * "published" toggle is a switch.
 *
 * Supports Radix's third state, `"indeterminate"`, drawn as a dash: the header
 * checkbox of a partially selected table is neither checked nor unchecked, and
 * showing it as either misreports the selection.
 */
export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-badge-md border border-border bg-background transition-colors",
        focusRingOffset,
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {props.checked === "indeterminate" ? (
          <Minus className="size-3.5" strokeWidth={3} />
        ) : (
          <Check className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);

Checkbox.displayName = "Checkbox";

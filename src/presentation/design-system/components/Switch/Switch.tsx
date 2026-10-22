"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRingOffset } from "../shared/focusRing";
import { stillWhenReduced } from "../shared/motion";

export type SwitchSize = "md" | "sm";

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  /**
   * `md` (48×28) for a form field; `sm` (36×20) for a switch sitting in a list
   * row beside its state word ("On menu"), where the row's label — not the
   * track — carries the 44px touch target.
   */
  size?: SwitchSize;
};

const ROOT_SIZE: Record<SwitchSize, string> = { md: "h-7 w-12", sm: "h-5 w-9" };

// Physical translate, so mirror the checked offset under RTL — flexbox already
// parks the unchecked thumb at the right (start) edge, the checked state moves it left.
const THUMB_SIZE: Record<SwitchSize, string> = {
  md: "size-6 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5",
  sm: "size-4 shadow-xs data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4",
};

/**
 * Boolean toggle built on Radix Switch. Green (`primary`) when on, muted track
 * when off; fully keyboard-operable and labelable via a `<label htmlFor>` or
 * `aria-label`. Controlled (`checked` + `onCheckedChange`) or uncontrolled
 * (`defaultChecked`).
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      ROOT_SIZE[size],
      focusRingOffset,
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-strong",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-background shadow-md transition-transform data-[state=unchecked]:translate-x-0",
        // The thumb still moves — that's the state — it just stops sliding there.
        stillWhenReduced,
        THUMB_SIZE[size],
      )}
    />
  </SwitchPrimitive.Root>
));

Switch.displayName = "Switch";

"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRingOffset } from "../shared/focusRing";
import { stillWhenReduced } from "../shared/motion";

export type SwitchProps = React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

/**
 * Boolean toggle built on Radix Switch. Green (`primary`) when on, muted track
 * when off; fully keyboard-operable and labelable via a `<label htmlFor>` or
 * `aria-label`. Controlled (`checked` + `onCheckedChange`) or uncontrolled
 * (`defaultChecked`).
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      focusRingOffset,
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-strong",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block size-6 rounded-full bg-background shadow-md transition-transform",
        // The thumb still moves — that's the state — it just stops sliding there.
        stillWhenReduced,
        // Physical translate, so mirror the checked offset under RTL — flexbox already
        // parks the unchecked thumb at the right (start) edge, the checked state moves it left.
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        "rtl:data-[state=checked]:-translate-x-5",
      )}
    />
  </SwitchPrimitive.Root>
));

Switch.displayName = "Switch";

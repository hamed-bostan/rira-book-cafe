"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Transient panel anchored to the control that opened it, built on Radix Popover.
 * Composable parts:
 *   <Popover> (root, controllable via `open`/`onOpenChange`)
 *     <PopoverTrigger asChild><Button …/></PopoverTrigger>
 *     <PopoverContent>…</PopoverContent>
 *   </Popover>
 *
 * Distinct from {@link Modal}, and the distinction is about consequence rather
 * than size: a modal takes the whole screen hostage because the answer it wants
 * has one — a popover is for adjusting something you can see behind it, which is
 * why it doesn't dim the page and why dismissing it is always harmless.
 *
 * Distinct from {@link Sheet} too: the sheet is the app's *mobile* overlay, tied
 * to the bottom of the viewport and to the mobile column. A popover is tied to
 * its trigger, which is what a toolbar filter needs — the panel reads as
 * belonging to the button that opened it.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export type PopoverContentProps = React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>;

export const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = "start", sideOffset = 8, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        // `collisionPadding` keeps the panel off the viewport edge when the
        // trigger sits near one — a toolbar filter at the right of a narrow
        // window would otherwise open flush against the frame.
        collisionPadding={12}
        className={cn(
          "z-50 rounded-card-lg border border-border bg-popover p-2 shadow-lg focus:outline-none",
          // Radix measures the trigger and the space around it and publishes both;
          // taking the height means a panel with a long option list scrolls
          // instead of being clipped by the viewport.
          "max-h-[var(--radix-popover-content-available-height)] overflow-y-auto",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          // Grows from the edge it's anchored to, so it reads as coming out of
          // the trigger rather than appearing over it. Motion-safe only; the fade
          // above carries the transition when motion is reduced.
          "motion-safe:data-[state=open]:zoom-in-95",
          "motion-safe:data-[state=closed]:zoom-out-95",
          "motion-safe:data-[side=bottom]:slide-in-from-top-2",
          "motion-safe:data-[side=top]:slide-in-from-bottom-2",
          "duration-150",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  ),
);

PopoverContent.displayName = "PopoverContent";

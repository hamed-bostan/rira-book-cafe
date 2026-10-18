"use client";

import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { Icon } from "../Icon";
import { focusRing } from "../shared/focusRing";
import { stillWhenReduced } from "../shared/motion";

/**
 * Disclosure list built on Radix Accordion. Composable parts:
 *   <Accordion type="single" collapsible>
 *     <AccordionItem value="detail">
 *       <AccordionTrigger>Product detail</AccordionTrigger>
 *       <AccordionContent>…</AccordionContent>
 *     </AccordionItem>
 *   </Accordion>
 *
 * Radix owns keyboard interaction and `data-state`; styling keys off it (the
 * chevron rotates on open). `type`/`collapsible` are passed straight through.
 */
export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("rounded-card-lg bg-surface", className)} {...props} />
));

AccordionItem.displayName = "AccordionItem";

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-12 w-full items-center justify-between px-4 text-body-strong text-foreground",
        "transition-colors",
        focusRing,
        "[&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <Icon
        icon={ChevronDown}
        size="sm"
        className={cn("shrink-0 text-foreground transition-transform duration-200", stillWhenReduced)}
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));

AccordionTrigger.displayName = "AccordionTrigger";

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden",
      // Grows to / shrinks from the height Radix measures. A size change, so
      // motion-safe only — under reduced motion the panel simply opens.
      "motion-safe:data-[state=closed]:animate-accordion-up motion-safe:data-[state=open]:animate-accordion-down",
    )}
    {...props}
  >
    {/* Padding lives on an inner box: on the animated element it would keep
        a sliver of height at "0" and snap at the end of the collapse. */}
    <div className={cn("px-4 pb-4 text-body-small text-muted-foreground", className)}>{children}</div>
  </AccordionPrimitive.Content>
));

AccordionContent.displayName = "AccordionContent";

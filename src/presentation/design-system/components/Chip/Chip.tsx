"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { chipRadioStateStyles, chipShapeStyles } from "./chipStyles";

import type { VariantProps } from "class-variance-authority";

export type ChipGroupProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

/**
 * Single-select chip group built on Radix RadioGroup: exactly one selected, with
 * roving tab-index + arrow-key navigation handled by Radix. Generic over a plain
 * string `value` — it carries no domain knowledge, so any feature can compose it
 * (e.g. `AddressLabelChips`). Provide an accessible name via `aria-label` /
 * `aria-labelledby`.
 */
export const ChipGroup = React.forwardRef<HTMLDivElement, ChipGroupProps>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("flex flex-wrap items-center gap-2", className)} {...props} />
));

ChipGroup.displayName = "ChipGroup";

export type ChipProps = React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> &
  VariantProps<typeof chipShapeStyles>;

/**
 * A single-select chip; must live inside a <ChipGroup>. Filled (`primary`) when
 * selected, outlined when not — driven by Radix's `data-state`, so there is no
 * controlled `selected` prop to keep in sync. For multi-select or clearable
 * groups use <ToggleChip> instead; both share `chipShapeStyles`.
 */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(({ className, size, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(chipShapeStyles({ size }), chipRadioStateStyles, className)}
    {...props}
  />
));

Chip.displayName = "Chip";

"use client";

import { Toggle as TogglePrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { chipShapeStyles, chipToggleStateStyles } from "./chipStyles";

import type { VariantProps } from "class-variance-authority";

export type ToggleChipProps = React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
  VariantProps<typeof chipShapeStyles>;

/**
 * An independently-toggleable chip, built on Radix Toggle (which supplies the
 * `aria-pressed` state and `data-state`). Visually identical to <Chip> — they
 * share `chipShapeStyles` — but each chip stands alone, so a row of them covers
 * both multi-select (dietary tags, brands) and clearable single-select
 * (a category filter you can switch off), neither of which a radio group can do.
 *
 * Controlled via `pressed` + `onPressedChange`, or uncontrolled via
 * `defaultPressed`. Group them in a <fieldset> with a legend, or any container
 * carrying an accessible name.
 */
export const ToggleChip = React.forwardRef<HTMLButtonElement, ToggleChipProps>(({ className, size, ...props }, ref) => (
  <TogglePrimitive.Root ref={ref} className={cn(chipShapeStyles({ size }), chipToggleStateStyles, className)} {...props} />
));

ToggleChip.displayName = "ToggleChip";

"use client";

import { type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../../shared/focusRing";
import { baseFieldStyles } from "../shared/baseFieldStyles";


export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> &
  VariantProps<typeof baseFieldStyles>;

/**
 * Dropdown control, sharing `baseFieldStyles` with `Input`/`Textarea` so it reads
 * as one field family (fill, border, sizing, disabled and `aria-invalid` states).
 *
 * Deliberately a native `<select>` rather than a Radix listbox: this app is
 * mobile-first, and the OS picker is both faster to operate on touch and better
 * at long option lists than anything rendered in-page. Only the trigger chevron
 * is normalized here so its size and logical edge inset are consistent across
 * browsers and writing directions.
 *
 * Options are passed as children; it owns no label, so wrap it in `<Field>`/
 * `<TextField>` or give it an `aria-label`.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, variant, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(baseFieldStyles({ size, variant }), "appearance-none bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2716%27%20height=%2716%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%23737373%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E)] bg-no-repeat bg-[position:right_0.75rem_center] bg-size-[1rem] rtl:bg-[position:left_0.75rem_center] cursor-pointer ps-3 pe-10", focusRing, className)}
      {...props}
    >
      {children}
    </select>
  ),
);

Select.displayName = "Select";

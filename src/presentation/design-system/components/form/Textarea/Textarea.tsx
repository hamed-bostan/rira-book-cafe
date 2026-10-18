"use client";

import { type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../../shared/focusRing";
import { baseFieldStyles } from "../shared/baseFieldStyles";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  Pick<VariantProps<typeof baseFieldStyles>, "variant">;

/**
 * Multi-line field control, sharing `baseFieldStyles` with `Input`/`Select` so it
 * reads as one field family (fill, border, disabled and `aria-invalid` states).
 *
 * It takes `variant` but deliberately NOT `size`: that axis sets a single-line
 * control's density. Rows and vertical resizing can grow the textarea beyond
 * its default minimum; a caller can adjust that minimum with `className`.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, variant, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(baseFieldStyles({ variant }), "min-h-32 resize-y p-3 text-body-default", focusRing, className)}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";

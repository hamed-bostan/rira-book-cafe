import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Status pill. Three independent axes:
 *
 *  - `variant` — the tone. `destructive` is the only *solid* red (a hard stop);
 *    the rest are tints, legible against both the page and card backgrounds.
 *  - `appearance` — `solid` (tint fill only) or `outline` (tint fill plus a
 *    matching border), the customer-facing treatment for order status.
 *  - `size` — `sm` for pills sitting inside dense table rows, `md` for a pill
 *    that stands alone as the status of the thing it labels.
 *
 * Border colours live in `compoundVariants` rather than on the tone itself, so a
 * `solid` badge never carries a dangling border class.
 */
const badgeVariants = cva("inline-flex items-center", {
  variants: {
    variant: {
      primary: "bg-accent text-accent-foreground",
      success: "bg-success text-success-foreground",
      warning: "bg-warning text-warning-foreground",
      info: "bg-info text-info-foreground",
      error: "bg-error text-error-foreground",
      destructive: "bg-destructive text-destructive-foreground",
      neutral: "bg-muted text-muted-foreground",
    },

    appearance: {
      solid: "",
      outline: "border",
    },

    size: {
      // `rounded-badge` (no suffix) is NOT a token — the semantic scale only
      // defines `badge.md` / `badge.lg`, so every size names one explicitly.
      sm: "rounded-badge-md px-2 py-1 text-label-compact",
      md: "rounded-badge-lg px-4 py-2 text-body-caption",
    },
  },

  compoundVariants: [
    { appearance: "outline", variant: "primary", className: "border-primary" },
    { appearance: "outline", variant: "success", className: "border-success-foreground" },
    { appearance: "outline", variant: "warning", className: "border-warning-foreground" },
    { appearance: "outline", variant: "info", className: "border-info-foreground" },
    { appearance: "outline", variant: "error", className: "border-error-foreground" },
    { appearance: "outline", variant: "destructive", className: "border-destructive" },
    { appearance: "outline", variant: "neutral", className: "border-border" },
  ],

  defaultVariants: {
    variant: "neutral",
    appearance: "solid",
    size: "sm",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, appearance, size, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, appearance, size }), className)} {...props} />
  ),
);

Badge.displayName = "Badge";

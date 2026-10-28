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
      // The redesigned dashboard's status pill: a fixed 24px, 12px semibold text.
      compact: "h-6 rounded-badge-md px-2 text-label-compact leading-4 whitespace-nowrap",
    },
  },

  compoundVariants: [
    { appearance: "outline", variant: "primary", className: "border-primary" },
    { appearance: "outline", variant: "success", className: "border-success-border" },
    { appearance: "outline", variant: "warning", className: "border-warning-border" },
    { appearance: "outline", variant: "info", className: "border-info-border" },
    { appearance: "outline", variant: "error", className: "border-error-border" },
    { appearance: "outline", variant: "destructive", className: "border-destructive" },
    { appearance: "outline", variant: "neutral", className: "border-border" },
  ],

  defaultVariants: {
    variant: "neutral",
    appearance: "solid",
    size: "sm",
  },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /**
   * A leading dot in the text colour — for a status read down a table column,
   * where the dot's position lines up and is found before the word is read.
   */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, appearance, size, dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, appearance, size }), dot && "gap-1.5", className)}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </span>
  ),
);

Badge.displayName = "Badge";

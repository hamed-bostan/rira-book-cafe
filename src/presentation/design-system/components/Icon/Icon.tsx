import { cva, type VariantProps } from "class-variance-authority";
import { type LucideProps } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-4",
      sm: "size-5",
      md: "size-6",
      lg: "size-7",
      xl: "size-8",
      // The redesigned dashboard's icons step down with the text from `sm`:
      // 20 → 16px beside body copy (`icon-md`), 24 → 20px for larger marks (`icon-lg`).
      "icon-md": "size-5 sm:size-4",
      "icon-lg": "size-6 sm:size-5",
    },
  },
  defaultVariants: { size: "md" },
});

export interface IconProps extends Omit<LucideProps, "size">, VariantProps<typeof iconVariants> {
  icon: React.ComponentType<LucideProps>;
  /** Provide a label to make the icon meaningful to screen readers. Omit for decorative icons. */
  label?: string;
}

/**
 * The line weight comes from the surrounding theme (`--icon-stroke`, see
 * `themes.ts`), falling back to lucide's 2. It's set as a style rather than the
 * `stroke-width` attribute because an attribute can't read a CSS variable; the
 * paths inherit it from the `<svg>`. A caller's own `strokeWidth` still wins.
 */
export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIcon, size, className, label, style, ...props }, ref) => (
    <LucideIcon
      ref={ref}
      className={cn(iconVariants({ size }), className)}
      style={props.strokeWidth === undefined ? { strokeWidth: "var(--icon-stroke, 2)", ...style } : style}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  ),
);

Icon.displayName = "Icon";

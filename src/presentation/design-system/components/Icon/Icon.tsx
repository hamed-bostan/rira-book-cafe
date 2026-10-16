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
    },
  },
  defaultVariants: { size: "md" },
});

export interface IconProps extends Omit<LucideProps, "size">, VariantProps<typeof iconVariants> {
  icon: React.ComponentType<LucideProps>;
  /** Provide a label to make the icon meaningful to screen readers. Omit for decorative icons. */
  label?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: LucideIcon, size, className, label, ...props }, ref) => (
    <LucideIcon
      ref={ref}
      className={cn(iconVariants({ size }), className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  ),
);

Icon.displayName = "Icon";

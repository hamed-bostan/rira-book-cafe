import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../shared/focusRing";
import { Spinner } from "../Spinner";

const buttonVariants = cva(
  [
    // No `gap` here on purpose: call sites space their own leading icons with
    // `me-*`, and a base gap would stack on top of that.
    "flex items-center justify-center",
    "px-4",
    "rounded-button",
    "text-button-default",
    "transition-colors",
    "duration-200",
    "ease-out",
    focusRing,
    // Also suppresses the hover styles below while disabled.
    "disabled:pointer-events-none",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-pressed disabled:bg-disabled disabled:text-disabled-foreground",
        outline:
          "border border-primary text-primary bg-transparent hover:bg-accent active:bg-accent active:text-primary-pressed active:border-primary-pressed disabled:border-disabled-border disabled:text-disabled-foreground",
        soft: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary-pressed disabled:bg-disabled disabled:text-disabled-foreground",
        ghost: "px-0 bg-transparent text-foreground hover:text-primary disabled:text-disabled-foreground",
        link: "px-0 bg-transparent text-primary hover:text-primary-hover hover:underline underline-offset-4 disabled:text-disabled-foreground disabled:no-underline",
      },

      size: {
        sm: "min-h-10 py-2 text-button-compact",
        md: "min-h-11 py-2.5",
        lg: "min-h-12 py-3",
      },

      iconOnly: {
        // shrink-0 keeps the square from being compressed by greedy flex
        // siblings (e.g. a w-full Input in the same row), which would squash
        // the width on the main axis and break the 1:1 aspect ratio.
        true: "p-0 shrink-0",
        false: "",
      },
    },

    compoundVariants: [
      { iconOnly: true, size: "sm", className: "size-10" },
      { iconOnly: true, size: "md", className: "size-11" },
      { iconOnly: true, size: "lg", className: "size-12" },
    ],

    defaultVariants: {
      variant: "primary",
      size: "md",
      iconOnly: false,
    },
  },
);

type ButtonBaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

/**
 * `asChild` and `loading` are mutually exclusive: `Slot` merges props onto the
 * single child it is given, so there is nowhere to put a spinner alongside it.
 * Encoded in the type rather than checked at runtime, so the combination simply
 * doesn't compile.
 */
export type ButtonProps = ButtonBaseProps &
  (
    | { asChild: true; loading?: never }
    | {
        asChild?: false;
        /** Shows a spinner and disables the button while an action is in flight. */
        loading?: boolean;
      }
  );

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, iconOnly, asChild = false, ...props }, ref) => {
    // In this branch the union narrows `loading` to `never`, so there is nothing
    // to strip before handing the props to Slot.
    if (asChild) {
      return <Slot ref={ref} className={cn(buttonVariants({ variant, size, iconOnly }), className)} {...props} />;
    }

    const { loading = false, children, disabled, ...buttonProps } = props;

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        // A loading button must not be re-submittable, so it disables itself.
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...buttonProps}
      >
        {loading && (
          <Spinner
            size="xs"
            className={cn(!iconOnly && React.Children.count(children) > 0 && "me-2")}
          />
        )}
        {/* An icon-only button is a fixed square: the spinner takes the icon's
            place rather than being crammed in beside it. */}
        {!(loading && iconOnly) && children}
      </button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };

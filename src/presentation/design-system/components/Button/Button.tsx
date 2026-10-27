import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../shared/focusRing";
import { pressable } from "../shared/motion";
import { Spinner } from "../Spinner";

const buttonVariants = cva(
  [
    // No `gap` here on purpose: call sites space their own leading icons with
    // `me-*`, and a base gap would stack on top of that.
    "flex items-center justify-center",
    "px-4",
    "rounded-button",
    "text-button-default",
    // Colours ease; the press scale (pressable) is motion-safe only.
    "transition-[color,background-color,border-color,scale]",
    "duration-200",
    "ease-out",
    pressable,
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
          "border border-primary bg-transparent text-primary hover:bg-accent active:border-primary-pressed active:bg-accent active:text-primary-pressed disabled:border-disabled-border disabled:text-disabled-foreground",
        soft: "bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground active:bg-primary-pressed disabled:bg-disabled disabled:text-disabled-foreground",
        // The quiet row action beside a primary one: a hairline and ink, no brand colour.
        secondary:
          "border border-border bg-background text-foreground hover:bg-muted active:bg-muted disabled:text-disabled-foreground [&_svg]:text-muted-foreground",
        // A hard stop, behind a confirmation (cancel a booking, mark a no-show).
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-error-foreground active:bg-error-foreground disabled:bg-disabled disabled:text-disabled-foreground",
        ghost: "bg-transparent px-0 text-foreground hover:text-primary disabled:text-disabled-foreground",
        link: "bg-transparent px-0 text-primary underline-offset-4 hover:text-primary-hover hover:underline disabled:text-disabled-foreground disabled:no-underline",
      },

      size: {
        sm: "min-h-10 py-2 text-button-compact",
        md: "min-h-11 py-2.5",
        lg: "min-h-12 py-3",
        // The redesigned dashboard's controls: a full 44px tap target on a phone,
        // the design's compact 36px (`control-md`) or 32px (`control-sm`) from
        // `sm`, with the text stepping from 16px to 14px alongside the body copy.
        "control-md": "min-h-11 py-1.5 text-body-default font-semibold sm:min-h-9 sm:text-body-small",
        "control-sm": "min-h-11 py-1 text-body-default font-semibold sm:min-h-8 sm:text-body-small",
      },

      iconOnly: {
        // shrink-0 keeps the square from being compressed by greedy flex
        // siblings (e.g. a w-full Input in the same row), which would squash
        // the width on the main axis and break the 1:1 aspect ratio.
        true: "shrink-0 p-0",
        false: "",
      },
    },

    compoundVariants: [
      { iconOnly: true, size: "sm", className: "size-10" },
      { iconOnly: true, size: "md", className: "size-11" },
      { iconOnly: true, size: "lg", className: "size-12" },
      { iconOnly: true, size: "control-md", className: "size-11 sm:size-9" },
      { iconOnly: true, size: "control-sm", className: "size-11 sm:size-8" },
      // A quiet button in the redesign is a medium weight beside the primary's semibold.
      { variant: "secondary", size: ["control-md", "control-sm"], className: "font-medium" },
      // The redesign dims a button it's holding back instead of greying it out: the
      // action keeps its own colour at 40%, so it still says what it will do once
      // the form is ready. A loading button is disabled too, but stays at full
      // strength while it works.
      {
        variant: "primary",
        size: ["control-md", "control-sm"],
        className: "disabled:bg-primary disabled:text-primary-foreground disabled:not-aria-busy:opacity-40",
      },
      {
        variant: "destructive",
        size: ["control-md", "control-sm"],
        className: "disabled:bg-destructive disabled:text-destructive-foreground disabled:not-aria-busy:opacity-40",
      },
      {
        variant: "secondary",
        size: ["control-md", "control-sm"],
        className: "disabled:text-foreground disabled:not-aria-busy:opacity-40",
      },
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
            // The button's own `aria-busy` announces the wait; a second live
            // region inside it would only repeat it.
            decorative
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

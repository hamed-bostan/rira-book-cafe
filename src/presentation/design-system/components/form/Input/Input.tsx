"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../../shared/focusRing";
import { baseFieldStyles } from "../shared/baseFieldStyles";

const inputVariants = cva(
  ["px-5", focusRing],
  {
    variants: {
      hasLeftElement: {
        true: "ps-10",
      },

      hasRightElement: {
        true: "pe-10",
      },
    },

    defaultVariants: {
      hasLeftElement: false,
      hasRightElement: false,
    },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof baseFieldStyles>,
    VariantProps<typeof inputVariants> {
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  /** Classes applied to the `<input>` itself; `className` styles the wrapper. */
  inputClassName?: string;
  /**
   * Overlay content rendered inside the field wrapper as a sibling *after* the
   * `<input>` — e.g. a floating label that reacts to the input through `peer-*`
   * variants. The input always carries the `peer` class for exactly this.
   */
  children?: React.ReactNode;
}

/**
 * The pure text-field control: the styled `<input>` plus optional left/right
 * adornment slots. It owns no label, placeholder policy, or error state — those
 * are field-layer concerns (see `TextField`, `FloatingField`). Use it bare with
 * an `aria-label` for label-less fields such as search.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      inputClassName,
      size,
      variant,

      leftElement,
      rightElement,
      children,

      ...props
    },
    ref,
  ) => {
    const hasLeft = Boolean(leftElement);
    const hasRight = Boolean(rightElement);

    return (
      <div className={cn("relative w-full", className)}>
        {hasLeft && (
          <div className="pointer-events-none absolute start-3 top-1/2 z-20 -translate-y-1/2 text-icon-muted">
            {leftElement}
          </div>
        )}

        <input
          ref={ref}
          className={cn(
            "peer",
            baseFieldStyles({ size, variant }),
            inputVariants({
              hasLeftElement: hasLeft,
              hasRightElement: hasRight,
            }),
            inputClassName,
          )}
          {...props}
        />

        {hasRight && (
          // Same inset as the left adornment, so the two sides read as a pair —
          // and so the 40px text padding clears the icon by the same 8px on both
          // sides. At the old 20px inset a long value ran flush into it.
          // Not `pointer-events-none` like the left slot: right adornments are
          // the interactive ones (the password toggle, a clear button).
          <div className="absolute end-3 top-1/2 z-20 -translate-y-1/2 text-icon-muted">{rightElement}</div>
        )}

        {children}
      </div>
    );
  },
);

Input.displayName = "Input";

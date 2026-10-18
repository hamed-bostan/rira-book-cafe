import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

const formMessageVariants = cva("", {
  variants: {
    /**
     * `error` announces itself (see `role` below); `hint` is supporting copy that
     * was already there before the user did anything, so it just reads in place.
     */
    tone: {
      error: "text-destructive",
      hint: "text-muted-foreground",
    },

    /**
     * `sm` sits under a single control — the message about *this* field.
     * `md` is the form-level message: a submit failure that belongs to the whole
     * form rather than any one input, so it carries more weight.
     */
    size: {
      sm: "text-body-small",
      md: "text-body-small-strong",
    },
  },

  defaultVariants: { tone: "error", size: "sm" },
});

export interface FormMessageProps
  extends React.HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof formMessageVariants> {}

/**
 * Validation and status copy under a control or a form.
 *
 * An `error` gets `role="alert"` automatically, which is the point of having
 * this: the message usually appears *after* a failed submit, and without a live
 * region a screen-reader user is left on a form that silently refused them.
 * Getting that right by hand at every call site is what didn't happen — the
 * copies drifted across three type sizes, and several forgot the role entirely.
 *
 * `role` can still be overridden (e.g. `status` for something non-urgent).
 * Alignment and width are layout, so they go through `className`.
 */
export const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, tone, size, role, ...props }, ref) => (
    <p
      ref={ref}
      role={role ?? (tone === "hint" ? undefined : "alert")}
      className={cn(formMessageVariants({ tone, size }), className)}
      {...props}
    />
  ),
);

FormMessage.displayName = "FormMessage";

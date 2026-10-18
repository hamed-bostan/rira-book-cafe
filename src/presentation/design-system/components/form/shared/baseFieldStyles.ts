import { cva } from "class-variance-authority";

/**
 * Shared base for every field control (Input, Textarea, OTP cells). Owns the
 * fill/border treatment, text colours, sizing, disabled and error states so the
 * whole form family stays visually consistent.
 *
 * The `variant` axis is the key distinction:
 *  - `outline` — the standard form field: a white fill with a hairline border so
 *    it's legible on white page backgrounds. This is the default.
 *  - `filled` — a borderless grey well, the search treatment. Defined by its fill
 *    rather than an outline (see `SearchBar`).
 */
export const baseFieldStyles = cva(
  [
    "w-full rounded-input transition-colors outline-none",
    "text-input-foreground placeholder:text-input-placeholder",
    "disabled:cursor-not-allowed disabled:opacity-50",
    // Error state is driven by `aria-invalid` so it composes with <Field /> and
    // native form validation. The compound `aria-invalid:focus-visible` rule keeps
    // the destructive ring while the field is focused, overriding the focus ring.
    "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive aria-invalid:focus-visible:ring-destructive",
  ],
  {
    variants: {
      variant: {
        outline: "border border-border bg-input",
        filled: "border border-transparent bg-input-filled",
      },
      size: {
        // Compact density, for controls sitting inside dashboard table rows and
        // toolbars rather than a standalone form.
        sm: "min-h-9 py-1.5 text-body-default sm:text-body-small",
        md: "min-h-10 py-2 text-body-default",
        lg: "min-h-12 py-3 text-body-default",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

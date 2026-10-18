import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { Icon, type IconProps } from "../Icon";

import { SpinnerLabel } from "./SpinnerLabel";

export type SpinnerProps = Omit<IconProps, "icon" | "label"> & {
  /**
   * What is being waited on, for screen readers ("Loading orders"). Defaults to
   * the localized "Loading…" when omitted.
   */
  label?: string;
  /**
   * Render the bare glyph with no live region. For a spinner that only repeats
   * what's already announced — inside a button that sets `aria-busy`, or beside
   * the visible word "Uploading…".
   */
  decorative?: boolean;
};

/**
 * The system's one busy indicator. Built on `<Icon>` rather than rendering a
 * lucide glyph directly, so it inherits the shared size scale (`xs`–`xl`).
 *
 * Accessible by default: the glyph sits inside a `role="status"` region with a
 * visually hidden, localized label, so a screen reader hears that something is
 * loading when the spinner is the only sign of it. Pass `decorative` when the
 * wait is already announced some other way.
 *
 * Inside a button, prefer `<Button loading>` over placing this by hand — the
 * button handles the spacing, marks itself busy, and disables itself so the
 * action can't be submitted twice.
 *
 * This keeps spinning under `prefers-reduced-motion` — deliberately, and as the
 * one exception to the system's motion policy (see `shared/motion.ts`). A still
 * spinner doesn't read as restraint, it reads as a hung application.
 */
export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, label, decorative = false, ...props }, ref) => {
    const glyph = <Icon ref={ref} icon={Loader2} className={cn("animate-spin", className)} {...props} />;

    if (decorative) return glyph;

    return (
      <span role="status" className="inline-flex">
        {glyph}
        <SpinnerLabel label={label} />
      </span>
    );
  },
);

Spinner.displayName = "Spinner";

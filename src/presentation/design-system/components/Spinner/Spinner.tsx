import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { Icon, type IconProps } from "../Icon";

export type SpinnerProps = Omit<IconProps, "icon">;

/**
 * The system's one busy indicator. Built on `<Icon>` rather than rendering a
 * lucide glyph directly, so it inherits the shared size scale and the same
 * decorative-vs-labelled accessibility rules as every other icon.
 *
 * Decorative by default: a spinner beside the word "Uploading…", or inside a
 * button that already sets `aria-busy`, would only repeat what's announced.
 * Pass `label` when the spinner is the *only* indication that work is in flight.
 *
 * Inside a button, prefer `<Button loading>` over placing this by hand — the
 * button handles the spacing, and disables itself so the action can't be
 * submitted twice.
 *
 * This keeps spinning under `prefers-reduced-motion` — deliberately, and as the
 * one exception to the system's motion policy (see `shared/motion.ts`). A still
 * spinner doesn't read as restraint, it reads as a hung application.
 */
export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(({ className, ...props }, ref) => (
  <Icon ref={ref} icon={Loader2} className={cn("animate-spin", className)} {...props} />
));

Spinner.displayName = "Spinner";

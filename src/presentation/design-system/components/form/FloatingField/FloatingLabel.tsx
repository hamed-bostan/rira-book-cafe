import { cn } from "@/src/lib/utils";

import { stillWhenReduced } from "../../shared/motion";
import { RequiredMark } from "../shared/RequiredMark";

type FloatingLabelProps = {
  htmlFor: string;
  label: string;
  required?: boolean;
  /** Horizontal offset that aligns the label with the input's text inset. */
  offset: string;
};

/**
 * Floating label rendered as the sibling *after* the input so it can react to the
 * input's state purely through Tailwind `peer-*` variants — no JavaScript focus or
 * value tracking. This keeps the label in sync for controlled, uncontrolled, and
 * programmatically-updated inputs alike, and is SSR-safe.
 *
 * Resting (empty + blurred) → centered + muted. Floating (has value or focused) →
 * pinned to the top border with a notch that masks the field background.
 */
export function FloatingLabel({ htmlFor, label, required, offset }: FloatingLabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "pointer-events-none absolute z-10 origin-left text-foreground transition-all duration-200",
        // The label still ends up on the border; it just stops travelling there.
        stillWhenReduced,
        // Default = floating position; overridden to centered while the placeholder shows.
        "top-0 -translate-y-1/2",
        "peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-muted-foreground",
        "peer-focus:top-0 peer-focus:text-foreground",
        // Notch: a strip the colour of the field/page background that masks the
        // border behind the label, so it reads as sitting on the field's edge.
        "before:absolute before:inset-x-0 before:top-1/2 before:h-0 before:-translate-y-1/2 before:bg-background before:content-['']",
        "peer-focus:before:h-1.5",
        offset,
      )}
    >
      <span className="relative z-10 px-1">
        {label}
        {required && <RequiredMark />}
      </span>
    </label>
  );
}

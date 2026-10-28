"use client";

import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type OverviewSegmentedProps<T extends string> = {
  /** Names the group for assistive tech ("Chart metric"). */
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  /** Share the full width equally, as in a dialog ("7 / 14 / 21 days"), rather than hugging the labels. */
  fill?: boolean;
};

/**
 * A two-or-three-way switch for what a card shows (revenue or orders). The chosen
 * option lifts off the well as a white chip; each is a pressed/unpressed button,
 * so it reads correctly as a set of toggles.
 */
export function OverviewSegmented<T extends string>({
  label,
  value,
  options,
  onChange,
  fill = false,
}: OverviewSegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex rounded-button bg-muted p-0.5", fill ? "w-full" : "shrink-0")}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-11 rounded-button px-3 text-body-default whitespace-nowrap transition-colors sm:h-8 sm:text-body-small",
              fill && "flex-1",
              focusRing,
              selected
                ? "bg-background font-semibold text-foreground shadow-xs"
                : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

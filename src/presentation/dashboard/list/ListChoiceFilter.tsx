"use client";

import { Check } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { PopoverClose } from "@/src/presentation/design-system";

import { ListFilterPopover } from "./ListFilterPopover";
import { useListParams } from "./useListParams";

import type { ListFilterOption } from "./ListFilterSelect";

type ListChoiceFilterProps = {
  /** Query param this filter writes to, e.g. `pipeline` or `delivery`. */
  paramName: string;
  /** The filter's name, on the trigger. */
  label: string;
  /** The "no filter" entry's label, e.g. "All statuses". */
  allLabel: string;
  /** The values on offer. The empty-string option is supplied by `allLabel`. */
  options: ListFilterOption[];
  icon?: React.ReactNode;
  /**
   * How many rows match each value, keyed by option value — the counts beside
   * "Pending 18". Optional: a filter only shows them when the screen has them
   * cheaply, and every option renders fine without.
   */
  counts?: Record<string, number>;
  /** Shows the unfiltered value beside the label instead of leaving it implicit. */
  showAllValue?: boolean;
  /** Responsive width or alignment overrides for the popover trigger. */
  triggerClassName?: string;
};

/**
 * A single-choice filter in a popover: pick one value, or clear it.
 *
 * This richer counterpart of {@link ListFilterSelect} can also show per-option
 * counts. Both controls use the same popover interaction and state styling so
 * every list toolbar looks and behaves alike.
 *
 * Selecting closes the panel — the choice is made and there's nothing left to do
 * in there. It also navigates immediately rather than waiting for an Apply, which
 * is right for one field but wrong for several at once (see `ListFilterForm`).
 */
export function ListChoiceFilter({
  paramName,
  label,
  allLabel,
  options,
  icon,
  counts,
  showAllValue = false,
  triggerClassName,
}: ListChoiceFilterProps) {
  const { searchParams, setFilter } = useListParams();
  const current = searchParams.get(paramName) ?? "";
  const selected = options.find((option) => option.value === current);

  const entries: ListFilterOption[] = [{ value: "", label: allLabel }, ...options];

  return (
    <ListFilterPopover
      label={label}
      value={selected?.label ?? (showAllValue ? allLabel : undefined)}
      isActive={current !== ""}
      icon={icon}
      triggerClassName={triggerClassName}
    >
      <div role="group" aria-label={label} className="flex flex-col">
        {entries.map((option) => {
          const isSelected = option.value === current;
          return (
            // Closing on select is the whole interaction: the panel exists to
            // take one answer, and leaving it open over a list that has already
            // re-fetched behind it just hides the result of the click.
            <PopoverClose
              key={option.value || "all"}
              type="button"
              // Announces the choice as a choice: without this a screen reader
              // hears a list of buttons and nothing about which one is in effect.
              aria-pressed={isSelected}
              onClick={() => setFilter(paramName, option.value || null)}
              className={cn(
                "flex items-center gap-2 rounded-button px-2 py-2 text-start text-body-bold transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "bg-accent font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <Check
                aria-hidden
                // Held in the layout rather than swapped in and out, so the labels
                // don't shift sideways as the selection moves down the list.
                className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
              />
              <span className="flex-1 truncate">{option.label}</span>
              {counts?.[option.value] != null ? (
                <span className="text-body-small text-muted-foreground">{counts[option.value]}</span>
              ) : null}
            </PopoverClose>
          );
        })}
      </div>
    </ListFilterPopover>
  );
}

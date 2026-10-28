"use client";

import { PopoverClose } from "@/src/presentation/design-system/components/Popover/Popover";

import { ListFilterPopover } from "./ListFilterPopover";
import { LIST_OPTIONS, ListOptionCheck, listOptionClass } from "./ListOption";
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
      <div role="group" aria-label={label} className={LIST_OPTIONS}>
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
              className={listOptionClass(isSelected)}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {counts?.[option.value] != null ? (
                <span className="font-normal text-muted-foreground tabular-nums">{counts[option.value]}</span>
              ) : null}
              <ListOptionCheck selected={isSelected} />
            </PopoverClose>
          );
        })}
      </div>
    </ListFilterPopover>
  );
}

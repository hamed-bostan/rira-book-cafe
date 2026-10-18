"use client";

import { cn } from "@/src/lib/utils";
import { PopoverClose } from "@/src/presentation/design-system/components/Popover/Popover";

import { ListFilterPopover } from "./ListFilterPopover";
import { useListParams } from "./useListParams";

export type ListFilterOption = {
  /** Query-param value; the empty string is the "no filter" option. */
  value: string;
  label: string;
};

type ListFilterSelectProps = {
  /** Query param this filter writes to, e.g. `categoryId` or `stock`. */
  paramName: string;
  /** Accessible name — filters sit in a toolbar with no visible labels. */
  label: string;
  options: ListFilterOption[];
  className?: string;
};

/**
 * A dropdown filter bound to one query param. Selecting an option navigates,
 * re-running the server render, and resets to page 1 (see `setFilter`).
 *
 * The empty-string option clears the filter rather than writing `?stock=` — the
 * parsers drop blank values, but a URL that carries dead params is harder to read
 * and to share.
 */
export function ListFilterSelect({ paramName, label, options, className }: ListFilterSelectProps) {
  const { searchParams, setFilter } = useListParams();
  const current = searchParams.get(paramName) ?? "";
  const selectedLabel = options.find((option) => option.value === current)?.label ?? options[0]?.label ?? label;

  return (
    <ListFilterPopover
      label={selectedLabel}
      isActive={current !== ""}
      contentClassName="w-[var(--radix-popover-trigger-width)] min-w-56"
      triggerClassName={className ?? "w-auto"}
    >
      <div role="radiogroup" aria-label={label} className="flex flex-col gap-1 p-1">
        {options.map((option) => {
          const isSelected = option.value === current;
          return (
            <PopoverClose asChild key={option.value || "all"}>
              <label
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-button px-2 py-2 text-start text-body-bold transition-colors",
                  isSelected ? "bg-accent font-medium text-primary" : "text-foreground hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={`list-filter-${paramName}`}
                  value={option.value}
                  checked={isSelected}
                  onChange={() => setFilter(paramName, option.value || null)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                    isSelected ? "border-primary" : "border-border",
                  )}
                >
                  {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="min-w-0 truncate">{option.label}</span>
              </label>
            </PopoverClose>
          );
        })}
      </div>
    </ListFilterPopover>
  );
}

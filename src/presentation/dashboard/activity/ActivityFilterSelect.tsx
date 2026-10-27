"use client";

import { type ListFilterOption, useListParams } from "@/src/presentation/dashboard/list";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";

type ActivityFilterSelectProps = {
  /** Query param this filter writes to, e.g. `actorId`. */
  paramName: string;
  /** The visible label above the control ("Changed by"). */
  label: string;
  /** The first option is the "no filter" one, with an empty value. */
  options: ListFilterOption[];
};

/**
 * One of the log's labelled filters: a native select bound to a query param.
 * Choosing an option navigates — re-running the server render from page 1 — and
 * the empty option clears the param rather than writing `?actorId=`.
 */
export function ActivityFilterSelect({ paramName, label, options }: ActivityFilterSelectProps) {
  const { searchParams, setFilter } = useListParams();

  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-body-default font-medium text-foreground sm:text-body-small">{label}</span>
      <Select
        size="control-md"
        value={searchParams.get(paramName) ?? ""}
        onChange={(event) => setFilter(paramName, event.target.value || null)}
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

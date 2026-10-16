"use client";

import { Check } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { Button, Input, PopoverClose } from "@/src/presentation/design-system";

import { ListFilterPopover } from "./ListFilterPopover";
import { useListParams } from "./useListParams";

/** The presets on offer, in the order they're listed. */
export const DATE_RANGE_PRESETS = [
  "today",
  "yesterday",
  "last7",
  "last30",
  "thisMonth",
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

type ListDateRangeFilterProps = {
  label: string;
  /** Labels for each preset plus the panel's own copy, supplied by the screen. */
  labels: Record<DateRangePreset, string> & {
    custom: string;
    from: string;
    to: string;
    apply: string;
    clear: string;
    /** How an active custom range reads on the trigger, e.g. "{from} – {to}". */
    rangeValue: (from: string | null, to: string | null) => string;
  };
  icon?: React.ReactNode;
  /** Text shown beside the label while no date range is active. */
  inactiveValue?: string;
  /** Query params the two bounds are written to. */
  fromParam?: string;
  toParam?: string;
};

/** Local midnight `days` ago (0 = today), as the instant the day begins. */
function startOfDay(daysAgo: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

/** The last instant of the local day `daysAgo` days back. */
function endOfDay(daysAgo: number): Date {
  const date = startOfDay(daysAgo);
  date.setDate(date.getDate() + 1);
  // One millisecond before the next day starts, so the bound is inclusive and
  // can't catch an order placed exactly at midnight into two adjacent ranges.
  return new Date(date.getTime() - 1);
}

/**
 * The two instants a preset resolves to.
 *
 * Resolved here, in the browser, and deliberately: "today" is a question about
 * the operator's own clock, and the server has no way to know what that is. The
 * URL therefore carries absolute instants rather than the word "today" — which
 * also means a filtered list stays the *same* list when it's shared or bookmarked,
 * instead of silently meaning something different tomorrow.
 */
function presetRange(preset: DateRangePreset): { from: Date; to: Date } {
  switch (preset) {
    case "today":
      return { from: startOfDay(0), to: endOfDay(0) };
    case "yesterday":
      return { from: startOfDay(1), to: endOfDay(1) };
    case "last7":
      return { from: startOfDay(6), to: endOfDay(0) };
    case "last30":
      return { from: startOfDay(29), to: endOfDay(0) };
    case "thisMonth": {
      const from = startOfDay(0);
      from.setDate(1);
      return { from, to: endOfDay(0) };
    }
  }
}

/** `YYYY-MM-DD` in local time, the value a `<input type="date">` round-trips. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Filter a list to orders placed within a date range — presets for the common
 * questions, two date fields for anything else.
 *
 * Writes two independent params, so a half-open range ("everything since
 * Monday") is expressible by filling one field. Both are sent as absolute
 * instants; see `presetRange` for why the resolution happens client-side.
 */
export function ListDateRangeFilter({
  label,
  labels,
  icon,
  inactiveValue,
  fromParam = "from",
  toParam = "to",
}: ListDateRangeFilterProps) {
  const { searchParams, setParams } = useListParams();
  const from = searchParams.get(fromParam);
  const to = searchParams.get(toParam);

  /**
   * Write both bounds in one navigation.
   *
   * One `setParams` rather than two `setFilter` calls: each would navigate off a
   * snapshot of the query string taken before the other landed, so the second
   * would drop the first's bound.
   */
  function applyRange(nextFrom: Date | null, nextTo: Date | null): void {
    const next = new URLSearchParams(searchParams);
    if (nextFrom) next.set(fromParam, nextFrom.toISOString());
    else next.delete(fromParam);
    if (nextTo) next.set(toParam, nextTo.toISOString());
    else next.delete(toParam);
    next.delete("page");
    setParams(next);
  }

  const active = from != null || to != null;

  return (
    <ListFilterPopover
      label={label}
      value={active ? labels.rangeValue(from, to) : inactiveValue}
      isActive={active}
      icon={icon}
      contentClassName="w-64"
    >
      <div className="flex flex-col">
        {DATE_RANGE_PRESETS.map((preset) => (
          <PopoverClose
            key={preset}
            type="button"
            onClick={() => {
              const range = presetRange(preset);
              applyRange(range.from, range.to);
            }}
            className={cn(
              "flex items-center gap-2 rounded-button px-2 py-2 text-start text-body-bold text-foreground transition-colors hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {labels[preset]}
          </PopoverClose>
        ))}

        <CustomRange labels={labels} from={from} to={to} onApply={applyRange} />
      </div>
    </ListFilterPopover>
  );
}

type CustomRangeProps = {
  labels: ListDateRangeFilterProps["labels"];
  from: string | null;
  to: string | null;
  onApply: (from: Date | null, to: Date | null) => void;
};

/**
 * The two date fields and their Apply.
 *
 * Split out so the draft lives *inside* the panel. Radix mounts popover content
 * only while it's open, so the fields are constructed fresh from the URL on every
 * open — which is what keeps them honest after a preset button has moved the
 * range behind them. Holding the draft in the filter itself, which stays mounted,
 * would leave the fields showing whatever was last typed rather than what the
 * list is actually filtered to.
 *
 * A draft with an explicit Apply rather than per-keystroke navigation, because a
 * range is only meaningful once: filtering on a half-typed year would page
 * through empty results on the way to every real answer.
 */
function CustomRange({ labels, from, to, onApply }: CustomRangeProps) {
  const [draftFrom, setDraftFrom] = React.useState(() => toDateInputValue(from));
  const [draftTo, setDraftTo] = React.useState(() => toDateInputValue(to));

  /** A field's day as an instant — its start for the lower bound, its last millisecond for the upper. */
  function parseDay(value: string, edge: "start" | "end"): Date | null {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return edge === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  return (
    <>
      <div className="mt-2 border-t border-border pt-2">
        <p className="px-2 pb-2 text-body-small text-muted-foreground">{labels.custom}</p>
        <div className="flex flex-col gap-2 px-2">
          <Input
            type="date"
            aria-label={labels.from}
            value={draftFrom}
            onChange={(event) => setDraftFrom(event.target.value)}
          />
          <Input
            type="date"
            aria-label={labels.to}
            value={draftTo}
            onChange={(event) => setDraftTo(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border px-2 pt-2">
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            setDraftFrom("");
            setDraftTo("");
            onApply(null, null);
          }}
        >
          {labels.clear}
        </Button>
        <PopoverClose asChild>
          <Button size="sm" onClick={() => onApply(parseDay(draftFrom, "start"), parseDay(draftTo, "end"))}>
            <Check aria-hidden className="me-1 size-4" />
            {labels.apply}
          </Button>
        </PopoverClose>
      </div>
    </>
  );
}

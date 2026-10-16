"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import type { SortDirection } from "@/src/domain/entities/Pagination";
import { mergePageParams } from "@/src/lib/api/pagination-params";
import { cn } from "@/src/lib/utils";
import { Icon, TableHead } from "@/src/presentation/design-system";
import { focusRing } from "@/src/presentation/design-system/components/shared";

import { useListParams } from "./useListParams";

type ListSortHeaderProps<TSort extends string> = {
  /** The column key this header sorts by — one of the list's allowed sort keys. */
  sortKey: TSort;
  /** Visible column label. */
  children: React.ReactNode;
  /** The list's default ordering, so an untouched table keeps a clean URL. */
  defaultSort?: TSort;
  defaultDirection?: SortDirection;
  /** Direction applied when this column is first clicked. `asc` for text, `desc` for "biggest first" columns. */
  initialDirection?: SortDirection;
  /** Set for numeric columns, whose cells are end-aligned. */
  align?: "start" | "end";
  className?: string;
};

/**
 * A sortable column header cell. Toggles the list's ordering through the URL, so
 * sorting re-runs the server render and orders the whole table rather than the
 * page currently on screen.
 *
 * It renders the `<th>` itself rather than just the button inside one: `aria-sort`
 * belongs on the header cell, and only this component knows the sort state — left
 * to the call site it would be duplicated into every table and drift out of sync
 * with the arrow.
 *
 * Clicking the active column flips its direction; clicking another switches to it
 * at `initialDirection`. There's no third "unsorted" click: a list always comes
 * back in *some* order, so cycling back to "none" would just mean the default —
 * reachable by sorting the default column, and confusing as a hidden third state.
 */
export function ListSortHeader<TSort extends string>({
  sortKey,
  children,
  defaultSort,
  defaultDirection,
  initialDirection = "asc",
  align = "start",
  className,
}: ListSortHeaderProps<TSort>) {
  const { searchParams, setParams } = useListParams();

  const activeSort = searchParams.get("sort") ?? defaultSort;
  const activeDirection = (searchParams.get("dir") as SortDirection | null) ?? defaultDirection;
  const isActive = activeSort === sortKey;
  const direction: SortDirection = !isActive ? initialDirection : activeDirection === "asc" ? "asc" : "desc";

  function toggle(): void {
    setParams(
      mergePageParams(
        searchParams,
        {
          sort: sortKey,
          direction: !isActive ? initialDirection : direction === "asc" ? "desc" : "asc",
          // Row 1 of the new ordering is what the user wants to see; staying on
          // page 7 after re-sorting shows an arbitrary middle slice.
          page: 1,
        },
        { sort: defaultSort, direction: defaultDirection },
      ),
    );
  }

  return (
    <TableHead
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "end" && "text-end", className)}
    >
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "inline-flex min-h-8 items-center gap-1 rounded-sm transition-colors hover:text-foreground",
          isActive && "text-foreground",
          focusRing,
        )}
      >
        {children}
        <Icon
          icon={isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown}
          size="sm"
          className={cn(!isActive && "opacity-50")}
        />
      </button>
    </TableHead>
  );
}

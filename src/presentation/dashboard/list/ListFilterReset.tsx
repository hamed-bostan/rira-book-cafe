"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/src/presentation/design-system";

import { useListParams } from "./useListParams";

type ListFilterResetProps = {
  label: string;
  /** Every param the toolbar's filters write. Anything else in the URL survives. */
  paramNames: string[];
  /** Keep the action visible as a stable toolbar affordance, even at the default state. */
  alwaysVisible?: boolean;
  className?: string;
};

/**
 * Clears the toolbar's filters in one navigation.
 *
 * Named rather than blanket-clearing the query string, because not everything in
 * there is a filter: the sort is a *preference*, and someone who arranged the
 * table by highest total and then narrowed it doesn't mean to lose the
 * arrangement when they widen it again. Paging is the exception and is dropped —
 * the page number describes a result set that no longer exists.
 *
 * Renders nothing when there's nothing to clear. A permanently visible Reset
 * beside a list that isn't filtered invites the click that does nothing, and then
 * teaches people it never does anything.
 */
export function ListFilterReset({ label, paramNames, alwaysVisible = false, className }: ListFilterResetProps) {
  const { searchParams, setParams } = useListParams();

  const active = paramNames.some((name) => searchParams.get(name));
  if (!active && !alwaysVisible) return null;

  function reset(): void {
    const next = new URLSearchParams(searchParams);
    for (const name of paramNames) next.delete(name);
    next.delete("page");
    setParams(next);
  }

  return (
    <Button variant="link" size="sm" onClick={reset} className={className}>
      <RotateCcw aria-hidden className="me-1 hidden size-4 dashboard-landscape:block xl:block" />
      {label}
    </Button>
  );
}

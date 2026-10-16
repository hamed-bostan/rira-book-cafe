"use client";

import { Checkbox } from "@/src/presentation/design-system";

import { useBulkSelection } from "./BulkSelectionProvider";

type BulkSelectAllCheckboxProps = {
  /** Accessible name for the header control, e.g. "Select all products on this page". */
  label: string;
};

/**
 * The header checkbox: selects every row on the current page, or none.
 *
 * On the *page*, not the whole filtered set. "Select all 4,000 matches" is a
 * different and much sharper tool — one click away from unpublishing a catalog —
 * and it isn't what a checkbox at the top of twenty rows appears to promise. If
 * that's ever wanted it should say so in words, not arrive by implication.
 */
export function BulkSelectAllCheckbox({ label }: BulkSelectAllCheckboxProps) {
  const { allState, toggleAll } = useBulkSelection();

  return (
    <Checkbox
      checked={allState}
      onCheckedChange={(checked) => toggleAll(checked === true)}
      aria-label={label}
    />
  );
}

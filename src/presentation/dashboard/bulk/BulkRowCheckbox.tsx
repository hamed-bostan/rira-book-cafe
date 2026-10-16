"use client";

import { Checkbox } from "@/src/presentation/design-system";

import { useBulkSelection } from "./BulkSelectionProvider";

type BulkRowCheckboxProps = {
  /** The row's id — what the bulk action will be sent. */
  id: string;
  /** Accessible name, e.g. "Select Organic Bananas". Rows have no visible label. */
  label: string;
};

/**
 * One row's selection checkbox. A client island inside an otherwise server-rendered
 * table — the row's content stays on the server, only the checkbox ships JS.
 *
 * `stopPropagation` because some of these tables make the whole row a link: without
 * it, ticking a box on the reviews or customers list would navigate away mid-
 * selection.
 */
export function BulkRowCheckbox({ id, label }: BulkRowCheckboxProps) {
  const { isSelected, toggle } = useBulkSelection();

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <Checkbox
        checked={isSelected(id)}
        onCheckedChange={(checked) => toggle(id, checked === true)}
        aria-label={label}
      />
    </span>
  );
}

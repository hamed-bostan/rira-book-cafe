"use client";

import * as React from "react";

/** What the selection context exposes to the checkboxes and the action bar. */
type BulkSelectionValue = {
  /** Ids currently selected, in no particular order. */
  selected: string[];
  /** How many rows are on the page — the denominator of "3 of 10 selected". */
  total: number;
  /** Whether one row is selected. */
  isSelected: (id: string) => boolean;
  /** Select or deselect one row. */
  toggle: (id: string, next: boolean) => void;
  /** Select every row on the page, or none. */
  toggleAll: (next: boolean) => void;
  /** `true`, `false`, or `"indeterminate"` when only some rows are selected. */
  allState: boolean | "indeterminate";
  /** Drop the whole selection — called after an action completes. */
  clear: () => void;
};

const BulkSelectionContext = React.createContext<BulkSelectionValue | null>(null);

type BulkSelectionProviderProps = {
  /**
   * Every id on the current page, in render order. The provider needs it to answer
   * "select all" and to know when the header checkbox is indeterminate.
   */
  ids: readonly string[];
  children: React.ReactNode;
};

/**
 * Holds which rows of a dashboard table are selected. Client state, deliberately
 * ephemeral: a selection is a thing you're in the middle of doing, not a fact about
 * the data, so it doesn't belong in the URL like the filters and paging do — a
 * shared link should reproduce someone's *view*, not a half-made decision.
 *
 * It resets when the page's ids change, which is what makes that safe. Paging,
 * filtering or a `router.refresh()` after a mutation all replace `ids`, and a
 * selection that survived would leave the action bar holding rows that are no
 * longer on screen — "delete 12" with three visible.
 *
 * Only the selection is client state. The rows themselves stay server-rendered, and
 * an action still writes over the API and calls `router.refresh()`; nothing here
 * keeps a client-side copy of the list.
 */
export function BulkSelectionProvider({ ids, children }: BulkSelectionProviderProps) {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());

  // The identity of `ids` changes on every render (it's mapped from props), so the
  // reset keys off the contents rather than the array. Reset during render (React's
  // "adjust state when a prop changes" pattern) rather than in an effect, so the
  // stale selection is never painted.
  const idsKey = ids.join(",");
  const [selectionKey, setSelectionKey] = React.useState(idsKey);
  if (selectionKey !== idsKey) {
    setSelectionKey(idsKey);
    setSelected(new Set());
  }

  const value = React.useMemo<BulkSelectionValue>(() => {
    // Only ids still on the page count. The reset above clears across page
    // changes, but it runs after the render that brought the new rows in, so for
    // that one paint the state can still hold ids that have gone.
    const onPage = ids.filter((id) => selected.has(id));

    return {
      selected: onPage,
      total: ids.length,
      isSelected: (id) => selected.has(id),
      toggle: (id, next) =>
        setSelected((current) => {
          const updated = new Set(current);
          if (next) updated.add(id);
          else updated.delete(id);
          return updated;
        }),
      toggleAll: (next) => setSelected(next ? new Set(ids) : new Set()),
      allState: onPage.length === 0 ? false : onPage.length === ids.length ? true : "indeterminate",
      clear: () => setSelected(new Set()),
    };
  }, [ids, selected]);

  return <BulkSelectionContext.Provider value={value}>{children}</BulkSelectionContext.Provider>;
}

/**
 * Read the surrounding selection. Throws outside a provider rather than returning a
 * no-op default — a checkbox rendered outside one would silently never select
 * anything, which looks like a broken table rather than a missing wrapper.
 */
export function useBulkSelection(): BulkSelectionValue {
  const value = React.useContext(BulkSelectionContext);
  if (!value) {
    throw new Error("useBulkSelection must be used inside a <BulkSelectionProvider>.");
  }
  return value;
}

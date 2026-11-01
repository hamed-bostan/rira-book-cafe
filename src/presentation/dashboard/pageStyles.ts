/**
 * The cards, bands and tables of the redesigned books and stock pages, shared so
 * their rows line up: 20px side insets, a 16px gutter between columns, and small
 * capitals on a muted band over the figures.
 */

/** A card with no ruled header of its own. */
export const PAGE_CARD = "min-w-0 rounded-card-lg border border-border bg-background shadow-xs";

/** Text in a row or a cell: 16px on a phone, 14px from `sm`. */
export const ROW_TEXT = "text-body-default sm:text-body-small";

/** The line under a row's name, or its code, a step smaller and muted. */
export const ROW_CAPTION = "text-body-small text-muted-foreground sm:text-body-caption";

/** The muted band naming a group of rows. */
export const GROUP_BAND =
  "border-b border-border bg-muted px-5 py-3 text-body-strong text-foreground sm:text-body-small-strong";

/** A table's heading row. */
export const TABLE_HEAD =
  "border-b border-border bg-muted text-body-caption leading-4 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";

/** A heading cell; the gutter is split between neighbours, the edges take the card's inset. */
export const TABLE_TH = "px-2 py-2 text-start first:ps-5 last:pe-5";

/** A body cell, on the same grid as the heading. */
export const TABLE_TD = "px-2 py-3 align-baseline first:ps-5 last:pe-5";

/** A figure in a column: at the inline-end, with digits that line up. */
export const AMOUNT = "text-end whitespace-nowrap tabular-nums";

/** A typed figure. `dir="ltr"` flips `text-end`, so the sides are named to stay under the column's heading. */
export const AMOUNT_INPUT = "text-right tabular-nums rtl:text-left";

/** The small capitals over a form's lines, on the same grid as the fields below them. */
export const LINE_HEAD =
  "text-body-caption leading-4 font-semibold tracking-wider whitespace-nowrap text-muted-foreground uppercase";

/** A form line stacks on a phone, ruled off from the next, and sits on one row from `md`. */
export const LINE_ROW = "grid items-start gap-x-3 gap-y-2 border-b border-border pb-3 md:border-0 md:pb-0";

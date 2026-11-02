import { AMOUNT, TABLE_TD } from "./pageStyles";

/**
 * A table that stacks on a narrow card, the way the journal's and the expenses'
 * rows do: each row leads with one cell on a line of its own, and the rest wrap
 * beneath it, each under a label of its own. Once the card is wide enough for the
 * columns it lines up as a table again, headings and all — and on paper it always
 * does, whatever the width, so a printout keeps its columns.
 *
 * It stays a `<table>` throughout; only the boxes change. The card is the container
 * the width is measured against (`frame`), and the sets differ only in the width
 * the columns need — the narrow set's fit any card, so it never stacks.
 */
export type StackedTableStyles = {
  /** The card around the table: the container its width is measured against. */
  frame: string;
  table: string;
  head: string;
  body: string;
  foot: string;
  /** A row: its lead on a line of its own, the other cells wrapping beneath. */
  row: string;
  /** A row of a label and one figure (an opening or closing balance), at either end of one line. */
  pairRow: string;
  /** The cell a stacked row leads with, on a line of its own. */
  lead: string;
  /** Any other cell: its label over its value. */
  cell: string;
  /** A figure: under its label when stacked, at the inline-end of its column in the table. */
  amount: string;
  /** A cell's label, standing in for the column heading while the row is stacked. */
  label: string;
  /** A row with one cell across it, such as "nothing here": the same in both layouts. */
  wholeRow: string;
  wholeCell: string;
};

export const STACKED_TABLE = {
  /**
   * Two columns, a name and its figure: a table at every width, as a phone's card
   * holds them. For a table whose columns vary, so one markup serves every count.
   */
  narrow: {
    frame: "",
    table: "w-full",
    head: "",
    body: "",
    foot: "",
    row: "",
    pairRow: "",
    lead: TABLE_TD,
    cell: TABLE_TD,
    amount: AMOUNT,
    label: "hidden",
    wholeRow: "",
    wholeCell: "",
  },
  /** Three or four columns: a table from a 36rem card — a tablet's. */
  compact: {
    frame: "@container/sheet",
    table: "block w-full table-fixed @xl/sheet:table print:table",
    head: "hidden @xl/sheet:table-header-group print:table-header-group",
    body: "block @xl/sheet:table-row-group print:table-row-group",
    foot: "block @xl/sheet:table-footer-group print:table-footer-group",
    row: "flex flex-wrap items-start gap-x-8 gap-y-2 px-5 py-3 @xl/sheet:table-row print:table-row",
    pairRow: "flex items-baseline justify-between gap-4 px-5 py-3 @xl/sheet:table-row print:table-row",
    lead: "block min-w-0 basis-full align-baseline @xl/sheet:table-cell @xl/sheet:px-2 @xl/sheet:py-3 @xl/sheet:first:ps-5 @xl/sheet:last:pe-5 print:table-cell print:px-2 print:py-3 print:first:ps-5 print:last:pe-5",
    cell: "flex min-w-0 flex-col gap-0.5 align-baseline @xl/sheet:table-cell @xl/sheet:px-2 @xl/sheet:py-3 @xl/sheet:first:ps-5 @xl/sheet:last:pe-5 print:table-cell print:px-2 print:py-3 print:first:ps-5 print:last:pe-5",
    amount: "whitespace-nowrap tabular-nums @xl/sheet:text-end print:text-end",
    label:
      "text-body-small font-normal whitespace-nowrap text-muted-foreground sm:text-body-caption @xl/sheet:hidden print:hidden",
    wholeRow: "block @xl/sheet:table-row print:table-row",
    wholeCell: "block @xl/sheet:table-cell print:table-cell",
  },
  /** Five or six columns: a table from a 56rem card — a laptop's. */
  wide: {
    frame: "@container/sheet",
    table: "block w-full table-fixed @4xl/sheet:table print:table",
    head: "hidden @4xl/sheet:table-header-group print:table-header-group",
    body: "block @4xl/sheet:table-row-group print:table-row-group",
    foot: "block @4xl/sheet:table-footer-group print:table-footer-group",
    row: "flex flex-wrap items-start gap-x-8 gap-y-2 px-5 py-3 @4xl/sheet:table-row print:table-row",
    pairRow: "flex items-baseline justify-between gap-4 px-5 py-3 @4xl/sheet:table-row print:table-row",
    lead: "block min-w-0 basis-full align-baseline @4xl/sheet:table-cell @4xl/sheet:px-2 @4xl/sheet:py-3 @4xl/sheet:first:ps-5 @4xl/sheet:last:pe-5 print:table-cell print:px-2 print:py-3 print:first:ps-5 print:last:pe-5",
    cell: "flex min-w-0 flex-col gap-0.5 align-baseline @4xl/sheet:table-cell @4xl/sheet:px-2 @4xl/sheet:py-3 @4xl/sheet:first:ps-5 @4xl/sheet:last:pe-5 print:table-cell print:px-2 print:py-3 print:first:ps-5 print:last:pe-5",
    amount: "whitespace-nowrap tabular-nums @4xl/sheet:text-end print:text-end",
    label:
      "text-body-small font-normal whitespace-nowrap text-muted-foreground sm:text-body-caption @4xl/sheet:hidden print:hidden",
    wholeRow: "block @4xl/sheet:table-row print:table-row",
    wholeCell: "block @4xl/sheet:table-cell print:table-cell",
  },
} as const satisfies Record<string, StackedTableStyles>;

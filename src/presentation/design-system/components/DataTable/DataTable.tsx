import * as React from "react";

import { cn } from "@/src/lib/utils";

export interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * A literal `min-w-*` class for the scrolling content, e.g. `"min-w-[40rem]"`.
   * Pass it to make the table scroll horizontally rather than crush its columns
   * on a narrow viewport; omit it for a table that fits.
   *
   * It has to be written out at the call site: Tailwind finds classes by scanning
   * source text, so a class built from a prop value at runtime is never emitted.
   */
  minWidthClassName?: string;
  /** Optional controls attached above the scrolling table content. */
  toolbar?: React.ReactNode;
  /** Optional controls attached below the scrolling table content. */
  footer?: React.ReactNode;
}

/**
 * The bordered frame every admin table sits in — the rounded, clipped card that
 * separates the table from the page.
 *
 * It deliberately says nothing about the rows inside. Some of these tables are
 * real `<table>` markup; others are CSS grids, because a grid row can be a single
 * link to a detail route and a `<tr>` can't. Both look the same from outside, and
 * that outside is what this owns.
 */
export const DataTable = React.forwardRef<HTMLDivElement, DataTableProps>(
  ({ className, minWidthClassName, toolbar, footer, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-card-lg border border-border bg-background shadow-xs", className)}
      {...props}
    >
      {toolbar ? <DataTableToolbar>{toolbar}</DataTableToolbar> : null}
      {minWidthClassName ? (
        <div className="overflow-x-auto">
          <div className={minWidthClassName}>{children}</div>
        </div>
      ) : (
        children
      )}
      {footer ? <DataTableFooter>{footer}</DataTableFooter> : null}
    </div>
  ),
);

DataTable.displayName = "DataTable";

/** Search, filters, and commands attached to a table's upper edge. */
export const DataTableToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "border-b border-border bg-background px-4 py-3 [--radius-button:var(--radius-card-md)] [--radius-input:var(--radius-card-md)]",
        className,
      )}
      {...props}
    />
  ),
);

DataTableToolbar.displayName = "DataTableToolbar";

/** Controls and summary attached to a table's lower edge. */
export const DataTableFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("border-t border-border bg-background px-4 py-3", className)} {...props} />
  ),
);

DataTableFooter.displayName = "DataTableFooter";

/* -------------------------------------------------------------------------- */
/* Semantic table                                                             */
/* -------------------------------------------------------------------------- */

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => <table ref={ref} className={cn("w-full text-start", className)} {...props} />,
);

Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn("bg-surface-sunken text-body-small-strong text-muted-foreground", className)}
      {...props}
    />
  ),
);

TableHeader.displayName = "TableHeader";

/** A column header. `scope="col"` is set here so no call site can forget it. */
export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, scope = "col", ...props }, ref) => (
    <th ref={ref} scope={scope} className={cn("px-4 py-3 text-start", className)} {...props} />
  ),
);

TableHead.displayName = "TableHead";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("divide-y divide-border", className)} {...props} />,
);

TableBody.displayName = "TableBody";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("bg-background transition-colors hover:bg-surface-sunken/50", className)} {...props} />
  ),
);

TableRow.displayName = "TableRow";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("px-4 py-3", className)} {...props} />,
);

TableCell.displayName = "TableCell";

/* -------------------------------------------------------------------------- */
/* Grid-based table                                                           */
/* -------------------------------------------------------------------------- */

interface DataGridRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The literal `grid grid-cols-[…]` class shared by this table's header and
   * rows, so the columns line up. Like `minWidthClassName`, it must be a literal
   * the Tailwind scanner can see — define it as a module constant and pass it to
   * both the header and every row.
   */
  template: string;
}

/**
 * Header row for a grid-based table — the counterpart to `<TableHeader>` for
 * tables whose rows can't be `<tr>`s.
 */
export const DataGridHeader = React.forwardRef<HTMLDivElement, DataGridRowProps>(
  ({ className, template, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(template, "bg-surface-sunken px-4 py-3 text-body-small-strong text-muted-foreground", className)}
      {...props}
    />
  ),
);

DataGridHeader.displayName = "DataGridHeader";

export const DataGridBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("divide-y divide-border", className)} {...props} />,
);

DataGridBody.displayName = "DataGridBody";

export const DataGridRow = React.forwardRef<HTMLDivElement, DataGridRowProps>(
  ({ className, template, ...props }, ref) => (
    <div ref={ref} className={cn(template, "bg-background px-4 py-3", className)} {...props} />
  ),
);

DataGridRow.displayName = "DataGridRow";

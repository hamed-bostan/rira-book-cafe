import { getTranslations } from "next-intl/server";

import type { Order } from "@/src/domain/entities/Order";
import { cn } from "@/src/lib/utils";
import { BulkSelectAllCheckbox } from "@/src/presentation/dashboard/bulk";
import {
  DataTable,
  Table,
  TableBody,
  TableHead,
  TableHeader,
} from "@/src/presentation/design-system/components/DataTable/DataTable";

import { OrderCard } from "./OrderCard";
import { OrderRow } from "./OrderRow";

import type { ReactNode } from "react";

type OrdersTableProps = {
  orders: Order[];
  /** Draws the selection and row-menu columns, and the cards' row menus (cards have no selection). */
  canFulfill: boolean;
  /** The status tabs along the frame's top edge, above the toolbar. */
  tabs?: ReactNode;
  /**
   * The strip under the tabs — search, filters and sorting, or the bulk actions
   * while rows are selected. Drawn as given: the caller frames it (`DataTableToolbar`
   * or `BulkActionBar`).
   */
  toolbar?: ReactNode;
  /** Shown inside the frame when the current query has no rows. */
  emptyState?: ReactNode;
  /** Pagination attached to the frame. */
  footer?: ReactNode;
};

/** Column headings: small caps-style labels, so the rows carry the weight. */
const HEAD = "h-10 px-2 py-0 text-start text-body-caption font-semibold tracking-wider whitespace-nowrap uppercase";

/**
 * The dashboard order list: cards on narrow content widths, a real table on wide
 * ones — switched on the container's width, so the sidebar's state counts.
 *
 * The table fits the narrowest card that shows it (56rem) with figures at the
 * order cap: its columns have fixed widths, the guest takes what's left, and a
 * name or a table's label too long for its column ends in an ellipsis. The frame
 * still scrolls rather than overflow if it ever had to, and is positioned, so the
 * screen-reader heading of the last column can't reach past it and widen the page.
 */
export async function OrdersTable({ orders, canFulfill, tabs, toolbar, emptyState, footer }: OrdersTableProps) {
  const t = await getTranslations("dashOrders");

  return (
    <DataTable className="min-w-0 bg-background" footer={orders.length > 0 ? footer : undefined}>
      {tabs}
      {toolbar}
      {orders.length > 0 ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 p-3 @min-[38rem]:grid-cols-2 @min-[56rem]:hidden">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} canFulfill={canFulfill} />
            ))}
          </div>
          <div className="relative hidden overflow-x-auto @min-[56rem]:block">
            <Table className="table-fixed">
              <caption className="sr-only">{t("heading")}</caption>
              <TableHeader>
                <tr>
                  {canFulfill ? (
                    <TableHead className="w-10 py-0 ps-2 pe-0">
                      <label className="flex size-8 cursor-pointer items-center justify-center">
                        <BulkSelectAllCheckbox label={t("selectAllAria")} />
                      </label>
                    </TableHead>
                  ) : null}
                  <TableHead className={cn(HEAD, canFulfill ? "w-16" : "w-20 ps-5")}>{t("colOrder")}</TableHead>
                  <TableHead className={HEAD}>{t("colGuest")}</TableHead>
                  {/* The item count sits under the service, as on a card. */}
                  <TableHead className={cn(HEAD, "w-44")}>{t("colService")}</TableHead>
                  <TableHead className={cn(HEAD, "w-36")}>{t("colStatus")}</TableHead>
                  <TableHead className={cn(HEAD, "w-24")}>{t("colPlaced")}</TableHead>
                  <TableHead className={cn(HEAD, "text-end", canFulfill ? "w-44" : "w-48 pe-5")}>
                    {t("colTotal")}
                  </TableHead>
                  {canFulfill ? (
                    <TableHead className="w-12">
                      <span className="sr-only">{t("colActions")}</span>
                    </TableHead>
                  ) : null}
                </tr>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} canFulfill={canFulfill} />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        emptyState
      )}
    </DataTable>
  );
}

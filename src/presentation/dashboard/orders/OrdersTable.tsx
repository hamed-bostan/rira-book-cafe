import { getTranslations } from "next-intl/server";

import type { Order } from "@/src/domain/entities/Order";
import { DataTable, Table, TableBody, TableHead, TableHeader } from "@/src/presentation/design-system";

import { OrderCard } from "./OrderCard";
import { OrderRow } from "./OrderRow";

import type { ReactNode } from "react";

type OrdersTableProps = {
  orders: Order[];
  /** Search, sorting and filters attached to the table's upper edge. */
  toolbar?: ReactNode;
  /** Shown inside the frame when the current query has no rows. */
  emptyState?: ReactNode;
  /** Pagination attached to the frame. */
  footer?: ReactNode;
};

/**
 * The dashboard order list: cards on narrow content widths, a real table on wide
 * ones — switched on the container's width, so the sidebar's state counts.
 */
export async function OrdersTable({ orders, toolbar, emptyState, footer }: OrdersTableProps) {
  const t = await getTranslations("dashOrders");

  return (
    <DataTable className="min-w-0" toolbar={toolbar} footer={orders.length > 0 ? footer : undefined}>
      {orders.length > 0 ? (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 p-3 @min-[38rem]:grid-cols-2 @min-[56rem]:hidden">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
          <div className="hidden @min-[56rem]:block">
            <Table>
              <caption className="sr-only">{t("heading")}</caption>
              <TableHeader>
                <tr>
                  <TableHead className="text-start">{t("colOrder")}</TableHead>
                  <TableHead className="text-start">{t("colGuest")}</TableHead>
                  <TableHead className="text-start">{t("colService")}</TableHead>
                  <TableHead className="text-start">{t("colItems")}</TableHead>
                  <TableHead className="text-start">{t("colStatus")}</TableHead>
                  <TableHead className="text-start">{t("colPlaced")}</TableHead>
                  <TableHead className="text-end">{t("colTotal")}</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <OrderRow key={order.id} order={order} />
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

import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { canChangeOrderLines } from "@/src/domain/entities/Order";
import { isSellable } from "@/src/domain/entities/Product";
import { sessionHas } from "@/src/lib/require-permission";
import { onlinePaymentsServerApi } from "@/src/presentation/dashboard/orders/online-payment-server-api";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrderDetailScreen } from "@/src/presentation/dashboard/orders/OrderDetailScreen";
import { productsServerApi } from "@/src/presentation/dashboard/products/product-server-api";

// The order, its status history, refunds, notes and any online payments it didn't
// take are fetched over the REST API (BFF) during server render; a missing order
// renders the not-found boundary.
export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  const [order, events, notes, refunds, onlinePayments, session] = await Promise.all([
    ordersServerApi.getById(id),
    ordersServerApi.listStatusEvents(id),
    ordersServerApi.listNotes(id),
    ordersServerApi.listRefunds(id),
    onlinePaymentsServerApi.listForOrder(id),
    auth(),
  ]);
  if (!order) notFound();

  // Which controls to draw; every endpoint re-checks for itself. Refunding, writing
  // off and giving back an online payment are money decisions: the books'
  // permission, not the floor's.
  const [canFulfill, canWriteBooks, canNote] = await Promise.all([
    sessionHas(session, "orders.fulfill"),
    sessionHas(session, "accounting.write"),
    sessionHas(session, "orders.note"),
  ]);

  // A second round is picked from the menu as it is now — read only when the order
  // can still take one.
  const menu =
    canFulfill && canChangeOrderLines(order)
      ? (await productsServerApi.list()).filter((product) => product.isPublished && isSellable(product))
      : [];

  return (
    <OrderDetailScreen
      order={order}
      events={events}
      notes={notes}
      refunds={refunds}
      onlinePayments={onlinePayments}
      menu={menu}
      canFulfill={canFulfill}
      canRefund={canWriteBooks}
      canWriteOff={canWriteBooks}
      canGiveBack={canWriteBooks}
      canNote={canNote}
    />
  );
}

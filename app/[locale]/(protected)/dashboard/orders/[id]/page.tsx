import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { sessionHas } from "@/src/lib/require-permission";
import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrderDetailScreen } from "@/src/presentation/dashboard/orders/OrderDetailScreen";

// The order, its status history and notes are fetched over the REST API (BFF)
// during server render; a missing order renders the not-found boundary.
export const dynamic = "force-dynamic";

type OrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  const [order, events, notes, session] = await Promise.all([
    ordersServerApi.getById(id),
    ordersServerApi.listStatusEvents(id),
    ordersServerApi.listNotes(id),
    auth(),
  ]);
  if (!order) notFound();

  // Which controls to draw; every endpoint re-checks for itself.
  const [canFulfill, canNote] = await Promise.all([
    sessionHas(session, "orders.fulfill"),
    sessionHas(session, "orders.note"),
  ]);

  return <OrderDetailScreen order={order} events={events} notes={notes} canFulfill={canFulfill} canNote={canNote} />;
}

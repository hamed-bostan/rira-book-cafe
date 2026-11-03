import { notFound } from "next/navigation";

import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrderReceiptScreen } from "@/src/presentation/dashboard/orders/OrderReceiptScreen";

// The receipt — the order, its payments and refunds, and the VAT inside it — is read
// over the REST API (BFF) during server render; a missing order renders the
// not-found boundary.
export const dynamic = "force-dynamic";

type OrderReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderReceiptPage({ params }: OrderReceiptPageProps) {
  const { id } = await params;
  const receipt = await ordersServerApi.getReceipt(id);
  if (!receipt) notFound();

  return <OrderReceiptScreen receipt={receipt} />;
}

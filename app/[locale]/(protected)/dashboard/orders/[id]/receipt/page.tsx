import { notFound } from "next/navigation";

import { ordersServerApi } from "@/src/presentation/dashboard/orders/order-server-api";
import { OrderReceiptScreen } from "@/src/presentation/dashboard/orders/OrderReceiptScreen";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";

// The receipt — the order, its payments and refunds, and the VAT inside it — is read
// over the REST API (BFF) during server render; a missing order renders the
// not-found boundary.
export const dynamic = "force-dynamic";

type OrderReceiptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderReceiptPage({ params }: OrderReceiptPageProps) {
  const { id } = await params;
  // The cafe's details head the slip; without them it prints with the site's name.
  const [receipt, cafe] = await Promise.all([ordersServerApi.getReceipt(id), cafeSettingsServerApi.getOrEmpty()]);
  if (!receipt) notFound();

  return <OrderReceiptScreen receipt={receipt} cafe={cafe} />;
}

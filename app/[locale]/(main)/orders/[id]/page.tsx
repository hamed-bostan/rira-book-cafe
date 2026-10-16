import { notFound } from "next/navigation";

import { requireAuth } from "@/src/lib/require-auth";
import { MyOrderScreen } from "@/src/presentation/storefront/orders/MyOrderScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

type MyOrderPageProps = {
  params: Promise<{ id: string }>;
};

/** One of the guest's own orders; anyone else's reads as not found. */
export default async function MyOrderPage({ params }: MyOrderPageProps) {
  await requireAuth();
  const { id } = await params;
  const order = await storefrontServerApi.myOrder(id);
  if (!order) notFound();

  return <MyOrderScreen order={order} />;
}

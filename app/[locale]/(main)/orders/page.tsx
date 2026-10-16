import { requireAuth } from "@/src/lib/require-auth";
import { MyOrdersScreen } from "@/src/presentation/storefront/orders/MyOrdersScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  await requireAuth();
  return <MyOrdersScreen orders={await storefrontServerApi.myOrders()} />;
}

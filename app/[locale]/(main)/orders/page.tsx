import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { MyOrdersScreen } from "@/src/presentation/storefront/orders/MyOrdersScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("orders.heading"));
}

export default async function MyOrdersPage() {
  await requireAuth();
  return <MyOrdersScreen orders={await storefrontServerApi.myOrders()} />;
}

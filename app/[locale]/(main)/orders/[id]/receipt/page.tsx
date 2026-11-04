import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";
import { MyOrderReceiptScreen } from "@/src/presentation/storefront/orders/MyOrderReceiptScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("orders.receipt"));
}

type MyOrderReceiptPageProps = {
  params: Promise<{ id: string }>;
};

/** The receipt for one of the guest's own orders; anyone else's reads as not found. */
export default async function MyOrderReceiptPage({ params }: MyOrderReceiptPageProps) {
  await requireAuth();
  const { id } = await params;
  const [receipt, cafe] = await Promise.all([
    storefrontServerApi.myOrderReceipt(id),
    cafeSettingsServerApi.getOrEmpty(),
  ]);
  if (!receipt) notFound();

  return <MyOrderReceiptScreen receipt={receipt} cafe={cafe} />;
}

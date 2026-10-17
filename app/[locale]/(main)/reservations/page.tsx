import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { MyReservationsScreen } from "@/src/presentation/storefront/reservations/MyReservationsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("reservations.heading"));
}

export default async function MyReservationsPage() {
  await requireAuth();
  const reservations = await storefrontServerApi.myReservations();
  return <MyReservationsScreen reservations={reservations} now={new Date().toISOString()} />;
}

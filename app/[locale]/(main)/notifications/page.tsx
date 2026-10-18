import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { NotificationsScreen } from "@/src/presentation/storefront/notifications/NotificationsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("notifications.heading"));
}

export default async function NotificationsPage() {
  await requireAuth();
  const notifications = await storefrontServerApi.notifications();
  return <NotificationsScreen notifications={notifications} now={new Date().toISOString()} />;
}

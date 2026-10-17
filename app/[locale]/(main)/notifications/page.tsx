import { requireAuth } from "@/src/lib/require-auth";
import { NotificationsScreen } from "@/src/presentation/storefront/notifications/NotificationsScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAuth();
  const notifications = await storefrontServerApi.notifications();
  return <NotificationsScreen notifications={notifications} now={new Date().toISOString()} />;
}

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { cafeTablesServerApi } from "@/src/presentation/dashboard/settings/cafe-table-server-api";
import { SettingsScreen } from "@/src/presentation/dashboard/settings/SettingsScreen";
import { cafeSettingsServerApi } from "@/src/presentation/settings/cafe-settings-server-api";

// The settings and the floor's tables are read over the REST API (BFF) per request —
// never from the site's cache, so the form edits what's stored right now.
export const dynamic = "force-dynamic";

export default async function DashboardSettingsPage() {
  await requirePermission("settings.write");
  const [settings, tables] = await Promise.all([cafeSettingsServerApi.getLatest(), cafeTablesServerApi.list()]);

  return <SettingsScreen settings={settings} tables={tables} today={cafeDayOf(new Date())} />;
}

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import {
  INVENTORY_VIEWS,
  InventoryScreen,
  type InventoryView,
} from "@/src/presentation/dashboard/inventory/InventoryScreen";

// Stock is read over the REST API (BFF) during server render. The list (`?level=`,
// default every item) and the search (`?q=`) live in the query string; every item
// is read at once, so each tab and card can show its count.
export const dynamic = "force-dynamic";

type InventoryPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const VIEW_SET = new Set<string>(INVENTORY_VIEWS);

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requirePermission("inventory.view");
  const params = toSearchParams(await searchParams);
  const level = params.get("level");
  const view = level && VIEW_SET.has(level) ? (level as InventoryView) : "all";
  const q = params.get("q")?.trim() || undefined;

  const [summary, canManage] = await Promise.all([
    inventoryServerApi.getSummary(),
    auth().then((session) => sessionHas(session, "inventory.manage")),
  ]);

  return (
    <InventoryScreen summary={summary} view={view} query={q} today={cafeDayOf(new Date())} canManage={canManage} />
  );
}

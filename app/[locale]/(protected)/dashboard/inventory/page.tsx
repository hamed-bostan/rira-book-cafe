import { auth } from "@/auth";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { InventoryScreen } from "@/src/presentation/dashboard/inventory/InventoryScreen";

// Stock is read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

type InventoryPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requirePermission("inventory.view");
  const level = toSearchParams(await searchParams).get("level");
  const [summary, canManage] = await Promise.all([
    inventoryServerApi.getSummary(),
    auth().then((session) => sessionHas(session, "inventory.manage")),
  ]);

  return <InventoryScreen summary={summary} filter={level === "low" || level === "out" ? level : "all"} canManage={canManage} />;
}

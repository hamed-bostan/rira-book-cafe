import { auth } from "@/auth";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ReturnsScreen } from "@/src/presentation/dashboard/inventory/ReturnsScreen";

// Returns to suppliers, read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function SupplierReturnsPage() {
  await requirePermission("inventory.view");
  const [returns, summary, canManage] = await Promise.all([
    inventoryServerApi.listReturns(),
    inventoryServerApi.getSummary(),
    auth().then((session) => sessionHas(session, "inventory.manage")),
  ]);

  return (
    <ReturnsScreen returns={returns} items={summary.items} costsVisible={summary.costsVisible} canManage={canManage} />
  );
}

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { ToOrderScreen } from "@/src/presentation/dashboard/inventory/ToOrderScreen";

// What to order, read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function ToOrderPage() {
  await requirePermission("inventory.view");
  const summary = await inventoryServerApi.getSummary();
  return <ToOrderScreen items={summary.items} today={cafeDayOf(new Date())} />;
}

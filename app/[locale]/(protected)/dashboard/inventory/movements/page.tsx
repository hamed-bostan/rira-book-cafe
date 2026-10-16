import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { MovementsScreen } from "@/src/presentation/dashboard/inventory/MovementsScreen";

export const dynamic = "force-dynamic";

type MovementsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockMovementsPage({ searchParams }: MovementsPageProps) {
  await requirePermission("inventory.view");
  const params = toSearchParams(await searchParams);
  const query: Record<string, string> = {};
  for (const key of ["item", "kind", "from", "to", "page", "pageSize"]) {
    const value = params.get(key);
    if (value) query[key] = value;
  }
  const [page, summary] = await Promise.all([inventoryServerApi.listMovements(query), inventoryServerApi.getSummary()]);

  return <MovementsScreen page={page} items={summary.items} costsVisible={summary.costsVisible} />;
}

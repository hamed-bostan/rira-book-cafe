import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission } from "@/src/lib/require-permission";
import { inventoryServerApi } from "@/src/presentation/dashboard/inventory/inventory-server-api";
import { MovementsScreen, type MovementQuery } from "@/src/presentation/dashboard/inventory/MovementsScreen";
import { withRememberedPageSize } from "@/src/presentation/dashboard/list/withRememberedPageSize";

export const dynamic = "force-dynamic";

type MovementsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function StockMovementsPage({ searchParams }: MovementsPageProps) {
  await requirePermission("inventory.view");
  const params = await withRememberedPageSize(toSearchParams(await searchParams));
  const query: Record<string, string> = {};
  for (const key of ["item", "kind", "from", "to", "page", "pageSize"]) {
    const value = params.get(key);
    if (value) query[key] = value;
  }
  const [page, summary] = await Promise.all([inventoryServerApi.listMovements(query), inventoryServerApi.getSummary()]);
  const filters: MovementQuery = { item: query.item, kind: query.kind, from: query.from, to: query.to };

  return (
    <MovementsScreen
      page={page}
      items={summary.items}
      costsVisible={summary.costsVisible}
      query={filters}
      today={cafeDayOf(new Date())}
    />
  );
}

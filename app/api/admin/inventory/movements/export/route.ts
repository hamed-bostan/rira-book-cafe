import { type NextRequest } from "next/server";

import { inventoryRepository } from "@/src/infrastructure/container";
import { parseCsvLocale } from "@/src/lib/api/accounting-csv";
import { csvResponse } from "@/src/lib/api/csv-response";
import { inventoryMessages, movementRows } from "@/src/lib/api/inventory-csv";
import { parseMovementFilters } from "@/src/lib/api/movement-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/movements/export — the movements the list's filters
 * (`?item=&kind=&from=&to=`) match, oldest first, as a CSV in `?locale=`. Values
 * are in the file only with `accounting.view`, as on screen; one item's file
 * carries its running balance. Requires `inventory.view`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const session = await getSessionWith("inventory.view");
  if (!session) return unauthorizedResponse();
  const query = request.nextUrl.searchParams;
  const locale = parseCsvLocale(query);

  try {
    const filters = parseMovementFilters(query);
    const [movements, items, messages, costsVisible] = await Promise.all([
      inventoryRepository.exportMovements(filters),
      inventoryRepository.listStock(true),
      inventoryMessages(locale),
      sessionHas(session, "accounting.view"),
    ]);
    const units = new Map(items.map((item) => [item.id, item.unit]));
    const span = [filters.fromDay ?? "start", filters.toDay ?? "today"].join("-to-");
    return csvResponse(`stock-movements-${span}.csv`, movementRows(movements, units, messages, locale, costsVisible));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/movements/export failed");
  }
}

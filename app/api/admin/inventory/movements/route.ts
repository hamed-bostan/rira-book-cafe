import { NextResponse, type NextRequest } from "next/server";

import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { STOCK_MOVEMENT_KINDS, type StockMovementKind } from "@/src/domain/entities/Inventory";
import type { MovementFilters } from "@/src/domain/repositories/IInventoryRepository";
import { inventoryRepository } from "@/src/infrastructure/container";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

const KINDS = new Set<string>(STOCK_MOVEMENT_KINDS);

/**
 * GET /api/admin/inventory/movements — every stock change, newest first. Filters:
 * `?item=`, `?kind=`, `?from=&to=`. Requires `inventory.view`; values only with `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.view");
  if (!session) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const filters: MovementFilters = {};
    const item = params.get("item")?.trim();
    if (item) filters.ingredientId = item;
    const kind = params.get("kind");
    if (kind && KINDS.has(kind)) filters.kind = kind as StockMovementKind;
    const from = params.get("from");
    if (from && isCafeDay(from)) filters.fromDay = from;
    const to = params.get("to");
    if (to && isCafeDay(to)) filters.toDay = to;

    const page = await inventoryRepository.listMovements(filters, parsePageRequest(params, []));
    const costs = await sessionHas(session, "accounting.view");
    return NextResponse.json(costs ? page : { ...page, items: page.items.map((movement) => ({ ...movement, value: 0 })) });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/movements failed");
  }
}

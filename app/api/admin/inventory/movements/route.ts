import { NextResponse, type NextRequest } from "next/server";

import { inventoryRepository } from "@/src/infrastructure/container";
import { parseMovementFilters } from "@/src/lib/api/movement-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/movements — every stock change, newest first. Filters:
 * `?item=`, `?kind=`, `?from=&to=`; narrowed to one item, each row carries its running
 * on-hand balance. Requires `inventory.view`; values only with `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.view");
  if (!session) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const page = await inventoryRepository.listMovements(parseMovementFilters(params), parsePageRequest(params, []));
    const costs = await sessionHas(session, "accounting.view");
    return NextResponse.json(
      costs ? page : { ...page, items: page.items.map((movement) => ({ ...movement, value: 0 })) },
    );
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/movements failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_ORDER_SORTS,
  DEFAULT_ADMIN_ORDER_DIRECTION,
  DEFAULT_ADMIN_ORDER_SORT,
} from "@/src/domain/entities/AdminOrderFilters";
import { ListOrders } from "@/src/domain/use-cases/orders/OrderQueries";
import { orderRepository } from "@/src/infrastructure/container";
import { parseAdminOrderFilters } from "@/src/lib/api/admin-order-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/orders — one page of the dashboard order list. Anyone with the
 * dashboard may read it. Query params: `page`, `pageSize`, `sort`, `dir` and `q`,
 * `status`, `service`, `payment`. Responds with `{ items, total, page, pageSize }`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  try {
    const filters = parseAdminOrderFilters(params);
    const page = parsePageRequest(params, ADMIN_ORDER_SORTS, {
      sort: DEFAULT_ADMIN_ORDER_SORT,
      direction: DEFAULT_ADMIN_ORDER_DIRECTION,
    });
    return NextResponse.json(await new ListOrders(orderRepository).execute(filters, page));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/orders failed");
  }
}

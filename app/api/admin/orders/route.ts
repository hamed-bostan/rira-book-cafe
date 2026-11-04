import { NextResponse, type NextRequest } from "next/server";

import { counterOrderSchema } from "@/src/contracts/order-schema";
import {
  ADMIN_ORDER_SORTS,
  DEFAULT_ADMIN_ORDER_DIRECTION,
  DEFAULT_ADMIN_ORDER_SORT,
} from "@/src/domain/entities/AdminOrderFilters";
import { ListOrders } from "@/src/domain/use-cases/orders/OrderQueries";
import { PlaceCounterOrder } from "@/src/domain/use-cases/orders/PlaceCounterOrder";
import { checkoutPricing, menuCatalog, orderRepository, userRepository } from "@/src/infrastructure/container";
import { parseAdminOrderFilters } from "@/src/lib/api/admin-order-params";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
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

/**
 * POST /api/admin/orders — ring up a sale at the counter, on the profile
 * `customerPhone` finds (made from `customerName`, with the sale, when it has none).
 * Prices come from the menu, and the discounts (a promo code, the guest's points) and
 * the service charge are priced on the server; it can be paid and handed over in the
 * same request. 201 with the order; 400 without a phone, or a name for a new guest, or
 * a payment that doesn't add up to the total; 409 when an item sold out or a code or
 * the points can't be used. Requires `orders.fulfill`.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = counterOrderSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new PlaceCounterOrder(orderRepository, menuCatalog, userRepository, checkoutPricing).execute(
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/orders failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

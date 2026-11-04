import { NextResponse, type NextRequest } from "next/server";

import { orderChangeSchema } from "@/src/contracts/order-schema";
import { ChangeOrder } from "@/src/domain/use-cases/orders/ChangeOrder";
import { GetOrderById } from "@/src/domain/use-cases/orders/OrderQueries";
import { checkoutPricing, customerNotifier, menuCatalog, orderRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
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

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/orders/:id — any order, for the dashboard's detail screen. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await new GetOrderById(orderRepository).execute(id);
    if (!order) return errorResponse(404, { message: "Order not found.", code: "NOT_FOUND" });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id} failed`);
  }
}

/**
 * PATCH /api/admin/orders/:id — change an order after it was placed: add a round,
 * lower or take off lines, move the table or change the service. Requires
 * `orders.fulfill`. 409 when the order no longer takes the change (paid, served, a
 * line already out, nothing left on it, a promo code or points it can't be priced
 * with), when an added item sold out, or when someone else changed it first.
 */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderChangeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new ChangeOrder(orderRepository, menuCatalog, checkoutPricing, customerNotifier).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/orders/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

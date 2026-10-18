import { NextResponse, type NextRequest } from "next/server";

import { orderItemServedSchema } from "@/src/contracts/order-schema";
import { SetOrderItemServed } from "@/src/domain/use-cases/orders/SetOrderItemServed";
import { orderRepository } from "@/src/infrastructure/container";
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

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

/**
 * PATCH /api/admin/orders/:id/items/:itemId — mark one line served, or take the
 * mark back. Requires `orders.fulfill`. 409 once the order is no longer being worked.
 */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const { id, itemId } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderItemServedSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That serving state isn't valid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new SetOrderItemServed(orderRepository).execute(id, itemId, parsed.data.served);
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/orders/${id}/items/${itemId} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

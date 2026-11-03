import { NextResponse, type NextRequest } from "next/server";

import { orderWriteOffSchema } from "@/src/contracts/order-schema";
import { WriteOffOrder } from "@/src/domain/use-cases/orders/WriteOffOrder";
import { ledgerRepository, orderRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/orders/:id/write-off — write off a served order nobody paid for
 * (a walk-out): it's cancelled and its sale taken off the books. A money decision,
 * so it takes `accounting.write` rather than the floor's `orders.fulfill`. 409 for
 * an order that isn't served and unpaid, or was paid meanwhile.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = orderWriteOffSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new WriteOffOrder(orderRepository, ledgerRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/orders/${id}/write-off failed`);
  }
}

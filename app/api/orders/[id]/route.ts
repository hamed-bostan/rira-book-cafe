import { NextResponse } from "next/server";

import { GetOwnOrder } from "@/src/domain/use-cases/orders/OrderQueries";
import { orderRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/orders/:id — one of the signed-in guest's own orders. Someone else's
 * order answers 404, the same as a missing one, so ids can't be probed. Staff read
 * any order through `GET /api/admin/orders/:id`.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await new GetOwnOrder(orderRepository).execute(id, session.user.id);
    if (!order) return errorResponse(404, { message: "Order not found.", code: "NOT_FOUND" });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/orders/${id} failed`);
  }
}

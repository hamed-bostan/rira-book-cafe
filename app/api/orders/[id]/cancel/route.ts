import { NextResponse } from "next/server";

import { CancelOwnOrder } from "@/src/domain/use-cases/orders/ChangeOrderStatus";
import { orderRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/orders/:id/cancel — the guest withdraws their own order while it's
 * still pending. 409 once staff have accepted it; 404 for anyone else's order.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const order = await new CancelOwnOrder(orderRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/orders/${id}/cancel failed`);
  }
}

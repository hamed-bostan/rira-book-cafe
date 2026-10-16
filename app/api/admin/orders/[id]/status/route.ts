import { NextResponse, type NextRequest } from "next/server";

import { orderStatusChangeSchema } from "@/src/contracts/order-schema";
import { ChangeOrderStatus } from "@/src/domain/use-cases/orders/ChangeOrderStatus";
import { ListOrderStatusEvents } from "@/src/domain/use-cases/orders/OrderQueries";
import { orderRepository } from "@/src/infrastructure/container";
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

/** GET /api/admin/orders/:id/status — the order's status history, oldest first. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await new ListOrderStatusEvents(orderRepository).execute(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id}/status failed`);
  }
}

/**
 * PATCH /api/admin/orders/:id/status — move the order along the workflow (or
 * cancel it). Requires `orders.fulfill`. 409 for a transition the workflow
 * refuses or one that lost a race with another change.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderStatusChangeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That status isn't valid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new ChangeOrderStatus(orderRepository).execute(id, parsed.data.status, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/orders/${id}/status failed`);
  }
}

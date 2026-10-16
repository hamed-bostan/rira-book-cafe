import { NextResponse, type NextRequest } from "next/server";

import { orderPaymentSchema } from "@/src/contracts/order-schema";
import { SetOrderPayment } from "@/src/domain/use-cases/orders/SetOrderPayment";
import { orderRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/orders/:id/payment — mark the order paid (with its method) or unpaid, and book it. Requires `orders.fulfill`. */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderPaymentSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That payment status isn't valid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const order = await new SetOrderPayment(orderRepository).execute(id, parsed.data.paymentStatus, parsed.data.paymentMethod, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(order);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/orders/${id}/payment failed`);
  }
}

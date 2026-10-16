import { NextResponse } from "next/server";

import { GetOrderById } from "@/src/domain/use-cases/orders/OrderQueries";
import { orderRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
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

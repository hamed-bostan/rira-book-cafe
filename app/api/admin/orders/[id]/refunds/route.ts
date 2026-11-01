import { NextResponse, type NextRequest } from "next/server";

import { orderRefundSchema } from "@/src/contracts/order-schema";
import { RefundOrder } from "@/src/domain/use-cases/orders/RefundOrder";
import { ledgerRepository, orderRepository } from "@/src/infrastructure/container";
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

/** GET /api/admin/orders/:id/refunds — the refunds on an order, oldest first. Anyone with the dashboard may read them. */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    return NextResponse.json(await orderRepository.listRefunds(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id}/refunds failed`);
  }
}

/**
 * POST /api/admin/orders/:id/refunds — hand money back on a completed order, in part
 * or in full, and book it. Money leaving the cafe, so it takes `accounting.write`
 * rather than the floor's `orders.fulfill`.
 */
async function handlePost(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await context.params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = orderRefundSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { refund, order } = await new RefundOrder(orderRepository, ledgerRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json({ refund, order }, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/orders/${id}/refunds failed`);
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

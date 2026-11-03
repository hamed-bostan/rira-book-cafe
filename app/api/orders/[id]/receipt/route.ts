import { NextResponse } from "next/server";

import { GetOwnOrderReceipt } from "@/src/domain/use-cases/orders/OrderReceipts";
import { ledgerRepository, orderRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/orders/:id/receipt — the receipt for one of the signed-in guest's own
 * orders, without the costs on its lines. Someone else's order answers 404, the same
 * as a missing one, so ids can't be probed.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const receipt = await new GetOwnOrderReceipt({ orders: orderRepository, ledger: ledgerRepository }).execute(
      id,
      session.user.id,
    );
    if (!receipt) return errorResponse(404, { message: "Order not found.", code: "NOT_FOUND" });
    return NextResponse.json(receipt);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/orders/${id}/receipt failed`);
  }
}

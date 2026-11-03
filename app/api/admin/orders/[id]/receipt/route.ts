import { NextResponse } from "next/server";

import { GetOrderReceipt } from "@/src/domain/use-cases/orders/OrderReceipts";
import { ledgerRepository, orderRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/orders/:id/receipt — any order's receipt for staff to print: the
 * order, how it was paid, its refunds and the VAT inside its total. Anyone with the
 * dashboard may read it.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const receipt = await new GetOrderReceipt({ orders: orderRepository, ledger: ledgerRepository }).execute(id);
    if (!receipt) return errorResponse(404, { message: "Order not found.", code: "NOT_FOUND" });
    return NextResponse.json(receipt);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id}/receipt failed`);
  }
}

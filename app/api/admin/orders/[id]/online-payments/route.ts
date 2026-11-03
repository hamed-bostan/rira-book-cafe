import { NextResponse, type NextRequest } from "next/server";

import { ListOrderUnappliedPayments } from "@/src/domain/use-cases/payments/UnappliedPayments";
import { paymentAttemptRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/orders/:id/online-payments — the order's online payments it didn't
 * take (captured after it was paid another way or cancelled): still to give back, or
 * given back. Oldest first. Anyone with the dashboard may read them.
 */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    return NextResponse.json(await new ListOrderUnappliedPayments(paymentAttemptRepository).execute(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/orders/${id}/online-payments failed`);
  }
}

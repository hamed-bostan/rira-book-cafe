import { NextResponse } from "next/server";

import { ListUnappliedPayments } from "@/src/domain/use-cases/payments/UnappliedPayments";
import { paymentAttemptRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/online-payments/unapplied — online payments the gateway captured
 * but no order could take, still to give back to the guest, oldest first, each with
 * its order's number. Anyone with the dashboard may read them.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListUnappliedPayments(paymentAttemptRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/online-payments/unapplied failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { onlinePaymentUpdateSchema } from "@/src/contracts/payment-schema";
import { MarkPaymentRefunded } from "@/src/domain/use-cases/payments/UnappliedPayments";
import { paymentAttemptRepository } from "@/src/infrastructure/container";
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

/**
 * PATCH /api/admin/online-payments/:id — mark an online payment no order took as
 * given back to the guest from the gateway's panel (`{ status: "refunded" }`).
 * Money leaving the cafe, so it takes `accounting.write`. 409 once it's no longer
 * waiting to be given back.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = onlinePaymentUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That payment status isn't valid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const attempt = await new MarkPaymentRefunded(paymentAttemptRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(attempt);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/online-payments/${id} failed`);
  }
}

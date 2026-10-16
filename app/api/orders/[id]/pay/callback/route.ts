import { NextResponse, type NextRequest } from "next/server";

import { type PaymentOutcome } from "@/src/domain/entities/PaymentAttempt";
import { NotFoundError } from "@/src/domain/errors/NotFoundError";
import { VerifyOnlinePayment } from "@/src/domain/use-cases/payments/OnlinePayment";
import { orderRepository, paymentAttemptRepository, paymentGateway } from "@/src/infrastructure/container";
import { getAppUrl } from "@/src/lib/appUrl";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/orders/:id/pay/callback?Authority=…&Status=OK|NOK — where Zarinpal
 * sends the guest back. Verifies the payment server-to-server (the query alone
 * proves nothing), marks the order paid when the gateway confirms it, and
 * redirects to the guest's order page with `?payment=<outcome>` to say how it went.
 *
 * Unauthenticated on purpose: the guest arrives from the gateway's domain, and the
 * attempt — looked up by its authority and checked against this order — is what
 * identifies the payment. Repeat hits are safe: an attempt is verified and booked once.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  const query = request.nextUrl.searchParams;
  const authority = query.get("Authority")?.trim() ?? "";

  let outcome: PaymentOutcome | "error";
  if (!authority) {
    outcome = "failed";
  } else {
    try {
      outcome = await new VerifyOnlinePayment(orderRepository, paymentAttemptRepository, paymentGateway).execute({
        orderId: id,
        authority,
        completed: query.get("Status") === "OK",
      });
    } catch (error) {
      if (!(error instanceof NotFoundError)) console.error(`GET /api/orders/${id}/pay/callback failed:`, error);
      outcome = error instanceof NotFoundError ? "failed" : "error";
    }
  }

  // 303: the follow-up is a plain GET of the order page, whatever method arrived.
  return NextResponse.redirect(`${await getAppUrl()}/orders/${encodeURIComponent(id)}?payment=${outcome}`, 303);
}

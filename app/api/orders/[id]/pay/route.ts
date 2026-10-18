import { NextResponse } from "next/server";

import { StartOnlinePayment } from "@/src/domain/use-cases/payments/OnlinePayment";
import { orderRepository, paymentAttemptRepository, paymentGateway } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getAppUrl } from "@/src/lib/appUrl";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/orders/:id/pay — the signed-in guest starts paying their own order
 * online. Answers `{ redirectUrl }`, the gateway page to send them to; the gateway
 * returns them to `GET /api/orders/:id/pay/callback`. 404 for anyone else's order,
 * 409 `NOT_PAYABLE` once it's paid or cancelled, 502 when the gateway is down.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const limited = await enforceRateLimit(request, RATE_LIMITS.paymentStart, session.user.id);
  if (limited) return limited;

  const { id } = await params;
  try {
    const callbackUrl = `${await getAppUrl()}/api/orders/${encodeURIComponent(id)}/pay/callback`;
    const { redirectUrl } = await new StartOnlinePayment(orderRepository, paymentAttemptRepository, paymentGateway).execute(
      id,
      session.user.id,
      callbackUrl,
    );
    return NextResponse.json({ redirectUrl }, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/orders/${id}/pay failed`);
  }
}

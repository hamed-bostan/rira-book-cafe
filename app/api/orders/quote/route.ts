import { NextResponse, type NextRequest } from "next/server";

import { quoteOrderSchema } from "@/src/contracts/order-schema";
import { QuoteOrder } from "@/src/domain/use-cases/orders/PlaceOrder";
import { checkoutPricing, productRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders/quote — what the basket would cost with a promo code and/or the
 * guest's points, priced exactly as placing it would be. Changes nothing. 409 with
 * the reason when the code can't be used (`PROMO_INVALID`, `PROMO_EXPIRED`, …).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = quoteOrderSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const quote = await new QuoteOrder(productRepository, checkoutPricing).execute(parsed.data, session.user.id, new Date());
    return NextResponse.json(quote);
  } catch (error) {
    return errorResponseFromException(error, "POST /api/orders/quote failed");
  }
}

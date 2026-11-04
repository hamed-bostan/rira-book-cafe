import { NextResponse, type NextRequest } from "next/server";

import { counterQuoteSchema } from "@/src/contracts/order-schema";
import { QuoteCounterOrder } from "@/src/domain/use-cases/orders/PlaceCounterOrder";
import { checkoutPricing, menuCatalog } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/orders/quote — what a counter sale would cost with a promo code
 * and/or the guest's points (read by `customerPhone`), and the service charge for a
 * dine-in sale: priced exactly as ringing it up will be. Changes nothing. 409 with
 * the reason when the code can't be used (`PROMO_INVALID`, `PROMO_NOT_ELIGIBLE`, …)
 * or there aren't points to spend. Requires `orders.fulfill`, like the sale.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("orders.fulfill"))) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = counterQuoteSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    return NextResponse.json(
      await new QuoteCounterOrder(menuCatalog, checkoutPricing).execute(parsed.data, new Date()),
    );
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/orders/quote failed");
  }
}

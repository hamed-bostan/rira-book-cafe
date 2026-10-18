import { NextResponse, type NextRequest } from "next/server";

import { placeOrderSchema } from "@/src/contracts/order-schema";
import { withoutCosts } from "@/src/domain/entities/Order";
import { ListOwnOrders } from "@/src/domain/use-cases/orders/OrderQueries";
import { PlaceOrder } from "@/src/domain/use-cases/orders/PlaceOrder";
import { checkoutPricing, orderRepository, productRepository, userRepository } from "@/src/infrastructure/container";
import { enforceRateLimit, RATE_LIMITS } from "@/src/lib/api/rate-limit";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

// Per-guest, request-time data — never statically cached.
export const dynamic = "force-dynamic";

/** GET /api/orders — the signed-in guest's own orders, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    const orders = await new ListOwnOrders(orderRepository).execute(session.user.id);
    return NextResponse.json(orders.map(withoutCosts));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/orders failed");
  }
}

/**
 * POST /api/orders — place an order as the signed-in guest. 201 with the order.
 *
 * Thin controller: authenticate → validate (shared Zod contract) → delegate to
 * `PlaceOrder`, which prices every line from the menu and applies any promo code
 * and points. 409 when an item sold out, the code can't be used, or the points
 * aren't there.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const limited = await enforceRateLimit(request, RATE_LIMITS.orderPlacement, session.user.id);
  if (limited) return limited;

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = placeOrderSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The guest's name and phone come from their account, never from the request.
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();

    const order = await new PlaceOrder(orderRepository, productRepository, checkoutPricing).execute(parsed.data, guest);
    return NextResponse.json(withoutCosts(order), { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/orders failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { orderBulkRequestSchema } from "@/src/contracts/bulk-action-schema";
import { BulkUpdateOrders } from "@/src/domain/use-cases/orders/BulkUpdateOrders";
import { customerNotifier, orderRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/orders/bulk — apply one action to a selection of orders (serve,
 * mark paid, cancel). Requires `orders.fulfill`, like the per-order routes.
 *
 * Thin controller: authenticate → validate (the same Zod schema the selection UI
 * uses) → delegate. Answers `{ updated }` — how many orders the action actually
 * changed; orders it doesn't fit are skipped, so the screen reports this number
 * rather than the selection size.
 *
 * Invalidates the catalog like the status route does: serving takes stock and
 * cancelling puts it back.
 */
async function handlePatch(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("orders.fulfill");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = orderBulkRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The actor comes from the session, never from the body.
    const updated = await new BulkUpdateOrders(orderRepository, customerNotifier).execute(
      parsed.data.ids,
      parsed.data.action,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    return errorResponseFromException(error, "PATCH /api/admin/orders/bulk failed");
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

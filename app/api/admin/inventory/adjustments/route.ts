import { NextResponse, type NextRequest } from "next/server";

import { stockAdjustmentSchema } from "@/src/contracts/inventory-schema";
import { AdjustStock } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { inventoryRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

/**
 * POST /api/admin/inventory/adjustments — a manual ± with a reason code (found,
 * damaged, staff meal, sampling, correction, other + note), at average cost, posted
 * to the reason's account. Requires `inventory.manage`; the movement's value is
 * only returned with `accounting.view`.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = stockAdjustmentSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const movement = await new AdjustStock(inventoryRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    const costs = await sessionHas(session, "accounting.view");
    return NextResponse.json(costs ? movement : { ...movement, value: 0 }, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/adjustments failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

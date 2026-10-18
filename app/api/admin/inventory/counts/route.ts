import { NextResponse, type NextRequest } from "next/server";

import { stockCountSchema } from "@/src/contracts/inventory-schema";
import { CountStock } from "@/src/domain/use-cases/inventory/InventoryCommands";
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
import { getSessionWith } from "@/src/lib/require-permission";

/**
 * POST /api/admin/inventory/counts — record a physical count: stock is set to what
 * was counted and the difference is posted to Inventory variance. Requires `inventory.manage`.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = stockCountSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const result = await new CountStock(inventoryRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/counts failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

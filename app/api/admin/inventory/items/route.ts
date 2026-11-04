import { NextResponse, type NextRequest } from "next/server";

import { stockItemSchema } from "@/src/contracts/inventory-schema";
import { SaveIngredient } from "@/src/domain/use-cases/pricing/PricingCommands";
import { pricingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

/**
 * POST /api/admin/inventory/items — add a stock item from Inventory, through the
 * same use-case Pricing adds ingredients with. It has no price yet: the first
 * delivery sets it (and Pricing can). Requires `inventory.manage`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = stockItemSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { reorderLevel, parLevel, supplierId, ...rest } = parsed.data;
    const item = await new SaveIngredient(pricingRepository).create(
      {
        ...rest,
        // Bought at nothing yet: one unit for zero, until a delivery says otherwise.
        purchasePrice: 0,
        purchaseQuantity: 1,
        reorderLevel: reorderLevel ?? undefined,
        parLevel: parLevel ?? undefined,
        supplierId: supplierId ?? undefined,
      },
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json({ id: item.id, name: item.name }, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/items failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { reorderLevelSchema, stockItemSchema } from "@/src/contracts/inventory-schema";
import { SetReorderLevel } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { SaveIngredient } from "@/src/domain/use-cases/pricing/PricingCommands";
import { inventoryRepository, pricingRepository } from "@/src/infrastructure/container";
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

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/inventory/items/:id — set (or clear) the low-stock level. Requires `inventory.manage`. */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = reorderLevelSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new SetReorderLevel(inventoryRepository).execute(id, parsed.data.reorderLevel, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/inventory/items/${id} failed`);
  }
}

/**
 * PUT /api/admin/inventory/items/:id — edit a stock item as Inventory keeps it: name,
 * unit (fixed once it has stock history), reorder and par levels, purchase units and
 * usual supplier. What it was bought at stays Pricing's. Requires `inventory.manage`.
 */
async function handlePut(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
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
    const item = await new SaveIngredient(pricingRepository).update(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json({ id: item.id, name: item.name });
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/inventory/items/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);
export const PUT = invalidatesCatalog([CATALOG_TAGS.products], handlePut);

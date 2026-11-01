import { NextResponse, type NextRequest } from "next/server";

import { TrackBooksInStock } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { inventoryRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/inventory/books — books for sale that no stock item stands behind. Requires `inventory.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("inventory.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await inventoryRepository.listUntrackedBooks());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/books failed");
  }
}

/**
 * POST /api/admin/inventory/books — put those books under stock: a stock item and a
 * one-copy recipe each, with the copies on the shelf as opening stock at their cost
 * price. Requires `inventory.manage`.
 */
async function handlePost(_request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();
  try {
    const result = await new TrackBooksInStock(inventoryRepository).execute({
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/books failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

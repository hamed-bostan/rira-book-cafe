import { NextResponse } from "next/server";

import { withoutStockCosts } from "@/src/domain/entities/Inventory";
import { GetInventory } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { inventoryRepository, ledgerRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory — stock on hand with low/out levels, and the check that
 * stock value equals the Inventory account. Requires `inventory.view`; costs and
 * values are only included with `accounting.view`.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSessionWith("inventory.view");
  if (!session) return unauthorizedResponse();
  try {
    const summary = await new GetInventory(inventoryRepository, ledgerRepository).execute();
    return NextResponse.json((await sessionHas(session, "accounting.view")) ? summary : withoutStockCosts(summary));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory failed");
  }
}

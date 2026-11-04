import { NextResponse } from "next/server";

import { inventoryRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/deliveries — recent deliveries from a named supplier
 * that aren't void, with what's still owed on each: what a return to the supplier
 * can be made against. Requires `inventory.manage`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("inventory.manage"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await inventoryRepository.listReturnableDeliveries());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/deliveries failed");
  }
}

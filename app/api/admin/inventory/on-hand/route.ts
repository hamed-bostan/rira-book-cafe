import { NextResponse, type NextRequest } from "next/server";

import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { inventoryRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/on-hand?date=YYYY-MM-DD — what each item had on hand at
 * the end of that day (on hand now, less what moved after it): what a backdated
 * count is compared with. Requires `inventory.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("inventory.view"))) return unauthorizedResponse();
  const date = request.nextUrl.searchParams.get("date") ?? "";
  if (!isCafeDay(date)) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: { date: "dateInvalid" },
    });
  }
  try {
    const onHand = await inventoryRepository.onHandAt(date);
    return NextResponse.json({ date, items: [...onHand].map(([id, quantity]) => ({ id, onHand: quantity })) });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/on-hand failed");
  }
}

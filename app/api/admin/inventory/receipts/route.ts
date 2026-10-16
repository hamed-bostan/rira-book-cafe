import { NextResponse, type NextRequest } from "next/server";

import { stockReceiptSchema } from "@/src/contracts/inventory-schema";
import { ReceiveStock } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { inventoryRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

/**
 * POST /api/admin/inventory/receipts — receive a delivery: stock comes in at cost,
 * and the supplier bill is booked to Inventory (payable or paid). Requires `inventory.manage`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = stockReceiptSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const expense = await new ReceiveStock(inventoryRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/receipts failed");
  }
}

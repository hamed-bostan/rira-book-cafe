import { NextResponse, type NextRequest } from "next/server";

import { reorderLevelSchema } from "@/src/contracts/inventory-schema";
import { SetReorderLevel } from "@/src/domain/use-cases/inventory/InventoryCommands";
import { inventoryRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/inventory/items/:id — set (or clear) the low-stock level. Requires `inventory.manage`. */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("inventory.manage"))) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = reorderLevelSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    await new SetReorderLevel(inventoryRepository).execute(id, parsed.data.reorderLevel);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/inventory/items/${id} failed`);
  }
}

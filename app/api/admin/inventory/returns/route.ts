import { NextResponse, type NextRequest } from "next/server";

import { supplierReturnSchema } from "@/src/contracts/inventory-schema";
import { withoutReturnCosts } from "@/src/domain/entities/Inventory";
import { ReturnToSupplier } from "@/src/domain/use-cases/inventory/InventoryCommands";
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

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/inventory/returns — stock sent back to suppliers, newest first;
 * `?supplier=` or `?expense=` narrows it. Requires `inventory.view`; credits and
 * values only with `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.view");
  if (!session) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const returns = await inventoryRepository.listSupplierReturns({
      supplierId: params.get("supplier")?.trim() || undefined,
      expenseId: params.get("expense")?.trim() || undefined,
    });
    const costs = await sessionHas(session, "accounting.view");
    return NextResponse.json(costs ? returns : returns.map(withoutReturnCosts));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/inventory/returns failed");
  }
}

/**
 * POST /api/admin/inventory/returns — send stock back to a supplier against a credit
 * note: the goods leave at average cost, the credit lowers what's owed on the
 * delivery's bill and the rest comes back to cash or the bank. Requires
 * `inventory.manage`.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("inventory.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = supplierReturnSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const created = await new ReturnToSupplier(inventoryRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/inventory/returns failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

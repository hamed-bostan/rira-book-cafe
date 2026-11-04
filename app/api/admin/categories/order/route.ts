import { NextResponse, type NextRequest } from "next/server";

import { categoryReorderSchema } from "@/src/contracts/category-schema";
import { ReorderCategories } from "@/src/domain/use-cases/categories/ReorderCategories";
import { categoryRepository } from "@/src/infrastructure/container";
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

export const dynamic = "force-dynamic";

/**
 * PUT /api/admin/categories/order — put one parent's categories in a new order
 * (`{ parentId: string | null, ids: string[] }`, first id first): what a drag in
 * the dashboard's list sends when it's dropped, the whole order in one request.
 * Requires `catalog.write`. 204 on success; 400 when an id isn't one of that
 * parent's categories, 404 when the parent doesn't exist.
 *
 * `PUT` on the order as a resource rather than a `POST …/reorder` action: the body
 * *is* the new state of the sibling order, and sending it twice changes nothing.
 */
async function handlePut(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = categoryReorderSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new ReorderCategories(categoryRepository).execute(parsed.data.parentId, parsed.data.ids, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/categories/order failed");
  }
}

export const PUT = invalidatesCatalog([CATALOG_TAGS.categories], handlePut);

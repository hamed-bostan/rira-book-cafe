import { NextResponse, type NextRequest } from "next/server";

import { productBulkRequestSchema, type ProductBulkAction } from "@/src/contracts/bulk-action-schema";
import type { BulkProductChange } from "@/src/domain/repositories/IProductRepository";
import { BulkUpdateProducts } from "@/src/domain/use-cases/products/BulkUpdateProducts";
import { productRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/products/bulk — apply one change to a selection of products
 * (publish, unpublish, move to a category). Admin only.
 *
 * Thin controller: authenticate → validate (the same Zod schema the selection UI
 * uses) → translate the wire action into the domain's `BulkProductChange` →
 * delegate. Answers `{ updated }` — the number of products the change actually
 * moved, which the screen reports rather than assuming the whole selection changed.
 *
 * `PATCH` on a collection sub-resource rather than a `POST /publish` action
 * endpoint: this is a partial update of several products, and one route with a
 * discriminated action keeps the auth check, the id validation and the cap in one
 * place instead of three near-identical handlers.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = productBulkRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The actor comes from the session, never from the body — otherwise the entries
    // this writes would record whoever the client claimed to be.
    const updated = await new BulkUpdateProducts(productRepository).execute(
      parsed.data.ids,
      toChange(parsed.data.action),
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    return errorResponseFromException(error, "PATCH /api/admin/products/bulk failed");
  }
}

/**
 * Map the wire action onto the domain's field/value pair. The two shapes differ on
 * purpose: the client speaks in verbs it has buttons for, the repository in the
 * column it writes.
 */
function toChange(action: ProductBulkAction): BulkProductChange {
  switch (action.type) {
    case "publish":
      return { field: "isPublished", value: true };
    case "unpublish":
      return { field: "isPublished", value: false };
    case "assignCategory":
      return { field: "categoryId", value: action.categoryId };
  }
}

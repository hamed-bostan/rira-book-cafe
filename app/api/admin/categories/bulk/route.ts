import { NextResponse, type NextRequest } from "next/server";

import { categoryBulkRequestSchema, type CategoryBulkAction } from "@/src/contracts/bulk-action-schema";
import type { BulkCategoryChange } from "@/src/domain/repositories/ICategoryRepository";
import { BulkUpdateCategories } from "@/src/domain/use-cases/categories/BulkUpdateCategories";
import { categoryRepository } from "@/src/infrastructure/container";
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
 * PATCH /api/admin/categories/bulk — apply one change to a selection of
 * categories (activate, deactivate). Admin only. Mirrors
 * `PATCH /api/admin/products/bulk` — see that route for the shape's rationale.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = categoryBulkRequestSchema.safeParse(body.data);
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
    const updated = await new BulkUpdateCategories(categoryRepository).execute(
      parsed.data.ids,
      toChange(parsed.data.action),
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json({ updated: updated.length });
  } catch (error) {
    return errorResponseFromException(error, "PATCH /api/admin/categories/bulk failed");
  }
}

/** Map the wire action onto the domain's field/value pair. */
function toChange(action: CategoryBulkAction): BulkCategoryChange {
  switch (action.type) {
    case "activate":
      return { field: "isActive", value: true };
    case "deactivate":
      return { field: "isActive", value: false };
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { productBulkDeleteSchema } from "@/src/contracts/bulk-action-schema";
import { DeleteProduct } from "@/src/domain/use-cases/products/DeleteProduct";
import { DeleteProducts } from "@/src/domain/use-cases/products/DeleteProducts";
import {
  bookLoanRepository,
  bookWaitlistRepository,
  imageReferences,
  imageStorageRepository,
  productRepository,
} from "@/src/infrastructure/container";
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
 * POST /api/admin/products/bulk/delete — delete a selection of menu items
 * (`{ ids }`). Requires `catalog.write`. Answers `{ deleted, refused }`: how many
 * went, and each one left in place with why (`bookInUse`, `notFound`) — a refusal
 * doesn't stop the rest.
 *
 * A `POST` to an action rather than `DELETE /bulk` with a body: a DELETE body has
 * no defined meaning in HTTP and proxies may drop it, and this answers with a
 * report rather than nothing.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = productBulkDeleteSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const deleteOne = new DeleteProduct(productRepository, bookLoanRepository, bookWaitlistRepository, {
      references: imageReferences,
      storage: imageStorageRepository,
    });
    const result = await new DeleteProducts(productRepository, deleteOne).execute(parsed.data.ids, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/products/bulk/delete failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products, CATALOG_TAGS.categories], handlePost);

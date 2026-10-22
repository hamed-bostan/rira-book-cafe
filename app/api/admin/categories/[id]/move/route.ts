import { NextResponse, type NextRequest } from "next/server";

import { categoryMoveSchema } from "@/src/contracts/category-schema";
import { MoveCategory } from "@/src/domain/use-cases/categories/MoveCategory";
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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/categories/:id/move — move a category one place up or down the
 * menu (`{ direction: "up" | "down" }`). Admin only. 204 on success; 400 when it's
 * already first (or last), 404 when it doesn't exist.
 */
async function handlePost(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = categoryMoveSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new MoveCategory(categoryRepository).execute(id, parsed.data.direction, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/categories/${id}/move failed`);
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.categories], handlePost);

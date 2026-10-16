import { NextResponse, type NextRequest } from "next/server";

import { categoryFormSchema } from "@/src/contracts/category-schema";
import { DeleteCategory } from "@/src/domain/use-cases/categories/DeleteCategory";
import { GetCategoryById } from "@/src/domain/use-cases/categories/GetCategoryById";
import { UpdateCategory } from "@/src/domain/use-cases/categories/UpdateCategory";
import {
  categoryRepository,
  imageStorageRepository,
} from "@/src/infrastructure/container";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Looked up in Postgres per request — never statically cached.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/:id — fetch one category. Public. 404 when it doesn't exist.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  const locale = getRequestLocale(request);
  try {
    const category = await new GetCategoryById(categoryRepository).execute(id, locale);
    if (!category) return errorResponse(404, { message: "Category not found.", code: "NOT_FOUND" });
    return NextResponse.json(category);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/categories/${id} failed`);
  }
}

/**
 * PUT /api/categories/:id — update a category. Admin only.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = categoryFormSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const updated = await new UpdateCategory(categoryRepository, imageStorageRepository).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/categories/${id} failed`);
  }
}

/**
 * DELETE /api/categories/:id — delete a category. Admin only. 204 on success.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    await new DeleteCategory(categoryRepository, imageStorageRepository).execute(
      id,
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/categories/${id} failed`);
  }
}

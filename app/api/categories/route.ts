import { NextResponse, type NextRequest } from "next/server";

import { categoryFormSchema } from "@/src/contracts/category-schema";
import { CreateCategory } from "@/src/domain/use-cases/categories/CreateCategory";
import { GetCategories } from "@/src/domain/use-cases/categories/GetCategories";
import { GetCategoryBySlug } from "@/src/domain/use-cases/categories/GetCategoryBySlug";
import { categoryRepository } from "@/src/infrastructure/container";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Categories are read from Postgres per request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/categories — list categories. Public (categories are shown on the
 * storefront). `?slug=<slug>` filters to the matching category — always returns
 * an array (0 or 1 element), keeping the collection's response shape consistent.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const slug = request.nextUrl.searchParams.get("slug");
  const locale = getRequestLocale(request);
  try {
    if (slug) {
      const category = await new GetCategoryBySlug(categoryRepository).execute(slug, locale);
      return NextResponse.json(category ? [category] : []);
    }
    const categories = await new GetCategories(categoryRepository).execute(locale);
    return NextResponse.json(categories);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/categories failed");
  }
}

/**
 * POST /api/categories — create a category. Admin only.
 *
 * Thin controller: authenticate → validate (same Zod schema the form uses) →
 * delegate to the use-case → map domain errors to HTTP status codes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

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
    const created = await new CreateCategory(categoryRepository).execute(parsed.data, { id: session.user.id, name: session.user.name ?? session.user.id });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/categories failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { GetCategoryTranslations } from "@/src/domain/use-cases/categories/GetCategoryTranslations";
import { categoryRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/:id/translations — the category's per-locale name overrides.
 * Admin only: it backs the dashboard edit form (the storefront reads localized
 * categories via the catalog endpoints, not this one).
 */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("catalog.write"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const translations = await new GetCategoryTranslations(categoryRepository).execute(id);
    return NextResponse.json(translations);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/categories/${id}/translations failed`);
  }
}

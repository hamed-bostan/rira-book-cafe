import { NextResponse, type NextRequest } from "next/server";

import { GetProductTranslations } from "@/src/domain/use-cases/products/GetProductTranslations";
import { productRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:id/translations — the product's per-locale content overrides.
 * Admin only: it backs the dashboard edit form (the storefront reads localized
 * products via the catalog endpoints, not this one).
 */
export async function GET(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("catalog.write"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const translations = await new GetProductTranslations(productRepository).execute(id);
    return NextResponse.json(translations);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id}/translations failed`);
  }
}

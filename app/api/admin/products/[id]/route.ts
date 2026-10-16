import { NextResponse, type NextRequest } from "next/server";

import { GetProductById } from "@/src/domain/use-cases/products/GetProductById";
import { productRepository } from "@/src/infrastructure/container";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import {
  errorResponse,
  errorResponseFromException,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Reads one product per request — never statically cached.
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/products/:id — one product in any visibility state. Admin only;
 * feeds the dashboard's edit screen.
 *
 * The public `GET /api/products/:id` answers 404 for an unpublished product, which
 * is right for a shopper and useless for the operator who just withdrew it — the
 * edit form has to stay reachable, or unpublishing would be a one-way door. Same
 * split as the repository's `getPublishedById` / `getById`, carried up to the API.
 *
 * Writes stay on `PUT`/`DELETE /api/products/:id`; this adds a read, not a second
 * place to change a product.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    const product = await new GetProductById(productRepository).execute(id, getRequestLocale(request));
    if (!product) return errorResponse(404, { message: "Product not found.", code: "NOT_FOUND" });
    return NextResponse.json(product);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/products/${id} failed`);
  }
}

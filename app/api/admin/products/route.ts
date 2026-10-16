import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_PRODUCT_SORTS,
  DEFAULT_ADMIN_PRODUCT_DIRECTION,
  DEFAULT_ADMIN_PRODUCT_SORT,
} from "@/src/domain/entities/AdminProductFilters";
import { ListProducts } from "@/src/domain/use-cases/products/ListProducts";
import { productRepository } from "@/src/infrastructure/container";
import { parseAdminProductFilters } from "@/src/lib/api/admin-product-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Reads a page of the catalog per request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/products — one page of the catalog-management list. Admin only.
 *
 * Query params: `page`, `pageSize`, `sort`, `dir` (paging) and `q`, `categoryId`,
 * `stock` (filters). Responds with `{ items, total, page, pageSize }`.
 *
 * Deliberately separate from the public `GET /api/products`, which answers with a
 * bare array the storefront depends on. Making that endpoint return a page when a
 * `page` param happened to be present would give one URL two response shapes —
 * and the two lists don't share a filter vocabulary anyway (a shopper filters by
 * dietary tag and brand; an operator filters by stock level).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;

  try {
    const filters = parseAdminProductFilters(params);
    const page = parsePageRequest(params, ADMIN_PRODUCT_SORTS, {
      sort: DEFAULT_ADMIN_PRODUCT_SORT,
      direction: DEFAULT_ADMIN_PRODUCT_DIRECTION,
    });
    const result = await new ListProducts(productRepository).execute(filters, page, getRequestLocale(request));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/products failed");
  }
}

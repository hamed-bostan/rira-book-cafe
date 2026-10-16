import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_CATEGORY_SORTS,
  DEFAULT_ADMIN_CATEGORY_DIRECTION,
  DEFAULT_ADMIN_CATEGORY_SORT,
} from "@/src/domain/entities/AdminCategoryFilters";
import { ListCategories } from "@/src/domain/use-cases/categories/ListCategories";
import { categoryRepository } from "@/src/infrastructure/container";
import { parseAdminCategoryFilters } from "@/src/lib/api/admin-category-params";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Reads a page of the category list per request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/categories — one page of the category-management list. Admin only.
 *
 * Query params: `page`, `pageSize`, `sort`, `dir` (paging) and `q`, `status`
 * (filters). Responds with `{ items, total, page, pageSize }`.
 *
 * Deliberately separate from the public `GET /api/categories`, which answers with a
 * bare array the storefront depends on — the same split `ListProducts` keeps from
 * the storefront's `GET /api/products`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const filters = parseAdminCategoryFilters(params);
  const page = parsePageRequest(params, ADMIN_CATEGORY_SORTS, {
    sort: DEFAULT_ADMIN_CATEGORY_SORT,
    direction: DEFAULT_ADMIN_CATEGORY_DIRECTION,
    pageSize: 10,
  });

  try {
    const result = await new ListCategories(categoryRepository).execute(filters, page, getRequestLocale(request));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/categories failed");
  }
}

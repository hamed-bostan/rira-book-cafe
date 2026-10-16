import { NextResponse, type NextRequest } from "next/server";

import { productFormSchema } from "@/src/contracts/product-schema";
import { withoutCost, type Product } from "@/src/domain/entities/Product";
import { hasProductSearchCriteria } from "@/src/domain/entities/ProductFilters";
import { CreateProduct } from "@/src/domain/use-cases/products/CreateProduct";
import { GetFeaturedProducts } from "@/src/domain/use-cases/products/GetFeaturedProducts";
import { GetProducts } from "@/src/domain/use-cases/products/GetProducts";
import { GetProductsByIds } from "@/src/domain/use-cases/products/GetProductsByIds";
import { SearchProducts } from "@/src/domain/use-cases/products/SearchProducts";
import { productRepository } from "@/src/infrastructure/container";
import { parseProductFilters } from "@/src/lib/api/product-search-params";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

// Products are read per request — never statically cached.
export const dynamic = "force-dynamic";

/**
 * GET /api/products — list products. Public.
 *
 * Filtered via query params:
 *   ?ids=a,b,c      → resolve these exact products (a lookup, not a search)
 *   ?q / ?categoryId / ?kind / ?minPrice / ?maxPrice / ?dietary (repeatable) /
 *   ?sort
 *                    → catalog search (any filter, incl. a lone category, routes here)
 *   ?featured=true   → featured products
 *   (none)           → every product
 *
 * Every filtered read — including a lone `categoryId` — goes through the one
 * search pipeline so ordering has a single source of truth (its `sort`, default
 * name A–Z) and never diverges by which branch served the request.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const filters = parseProductFilters(params);
  const locale = getRequestLocale(request);

  try {
    let products: Product[];
    // `ids` is a lookup, not a search: it answers "label these exact products"
    // for screens that already hold the ids, so it's checked before the filter
    // branches and never combines with them.
    const ids = params.get("ids");
    if (ids != null) {
      const wanted = ids.split(",").map((id) => id.trim()).filter(Boolean);
      products = await new GetProductsByIds(productRepository).execute(wanted, locale);
    } else if (hasProductSearchCriteria(filters)) {
      products = await new SearchProducts(productRepository).execute(filters, locale);
    } else if (params.get("featured") === "true") {
      products = await new GetFeaturedProducts(productRepository).execute(locale);
    } else {
      products = await new GetProducts(productRepository).execute(locale);
    }
    return NextResponse.json(products.map(withoutCost));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/products failed");
  }
}

/**
 * POST /api/products — create a product. Admin only.
 *
 * Thin controller: authenticate → validate (same Zod schema the form uses) →
 * delegate to the use-case → map domain errors to HTTP status codes.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = productFormSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The actor attributes the activity entry.
    const created = await new CreateProduct(productRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/products failed");
  }
}

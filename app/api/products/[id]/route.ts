import { NextResponse, type NextRequest } from "next/server";

import { productFormSchema } from "@/src/contracts/product-schema";
import { DeleteProduct } from "@/src/domain/use-cases/products/DeleteProduct";
import { GetPublishedProduct } from "@/src/domain/use-cases/products/GetPublishedProduct";
import { UpdateProduct } from "@/src/domain/use-cases/products/UpdateProduct";
import { productRepository } from "@/src/infrastructure/container";
import { getRequestLocale } from "@/src/lib/api/request-locale";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:id — fetch one product. Public. 404 when it doesn't exist —
 * or when it's unpublished, which to this endpoint is the same answer: a withdrawn
 * product must not still be readable by anyone holding the link. The dashboard's
 * `GET /api/admin/products/:id` is the read that sees every state.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  try {
    const product = await new GetPublishedProduct(productRepository).execute(id, getRequestLocale(request));
    if (!product) return errorResponse(404, { message: "Product not found.", code: "NOT_FOUND" });
    return NextResponse.json(product);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id} failed`);
  }
}

/**
 * PUT /api/products/:id — update a product. Admin only.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
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
    // The actor attributes the activity entry to whoever saved the form.
    const updated = await new UpdateProduct(productRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/products/${id} failed`);
  }
}

/**
 * DELETE /api/products/:id — delete a product. Admin only. 204 on success.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("catalog.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    // The actor comes from the session, never from the request — this is the one
    // change whose activity entry is the only surviving record of the product.
    await new DeleteProduct(productRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/products/${id} failed`);
  }
}

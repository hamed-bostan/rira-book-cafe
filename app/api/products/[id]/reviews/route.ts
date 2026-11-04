import { NextResponse, type NextRequest } from "next/server";

import { ListProductReviews } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponseFromException } from "@/src/lib/api/responses";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:id/reviews — the item's approved reviews, newest first, with
 * how many there are: `{ items, total }`. Public. `?limit=` asks for more than the
 * first page ("Show more"); it's rounded up to whole pages and capped.
 */
export async function GET(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  const limit = Number(request.nextUrl.searchParams.get("limit")) || undefined;
  try {
    return NextResponse.json(await new ListProductReviews(reviewRepository).execute(id, limit));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id}/reviews failed`);
  }
}

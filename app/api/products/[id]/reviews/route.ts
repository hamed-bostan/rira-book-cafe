import { NextResponse } from "next/server";

import { ListProductReviews } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponseFromException } from "@/src/lib/api/responses";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/products/:id/reviews — the item's approved reviews, newest first. Public. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  try {
    return NextResponse.json(await new ListProductReviews(reviewRepository).execute(id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id}/reviews failed`);
  }
}

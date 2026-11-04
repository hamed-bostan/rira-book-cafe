import { NextResponse } from "next/server";

import { ListReviewedProducts } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reviews/products — the items that have any reviews, by name
 * (`[{ productId, productName }]`): the moderation queue's item filter. Requires
 * `reviews.moderate`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("reviews.moderate"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListReviewedProducts(reviewRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reviews/products failed");
  }
}

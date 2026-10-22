import { NextResponse } from "next/server";

import { GetApprovedRating } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reviews/rating — the average stars across every approved review,
 * and how many (`{ rating, ratingCount }`). Requires `reviews.moderate`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("reviews.moderate"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new GetApprovedRating(reviewRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reviews/rating failed");
  }
}

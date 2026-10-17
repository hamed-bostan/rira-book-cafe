import { NextResponse } from "next/server";

import { CountReviews } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/reviews/counts — how many reviews are pending, approved and rejected. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("reviews.moderate"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new CountReviews(reviewRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reviews/counts failed");
  }
}

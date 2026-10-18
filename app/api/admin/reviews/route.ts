import { NextResponse, type NextRequest } from "next/server";

import { REVIEW_VIEWS, type ReviewView } from "@/src/domain/repositories/IReviewRepository";
import { ListReviews } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { reviewRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

const VIEW_SET = new Set<string>(REVIEW_VIEWS);

/**
 * GET /api/admin/reviews — the moderation queue. `?view=` pending (default) |
 * approved | rejected | all, and optional `?q=` (item, author or words).
 * Requires `reviews.moderate`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("reviews.moderate"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const view = params.get("view") ?? "pending";
  if (!VIEW_SET.has(view)) return errorResponse(400, { message: "Unknown view.", code: "VALIDATION" });

  try {
    const reviews = await new ListReviews(reviewRepository).execute({
      view: view as ReviewView,
      q: params.get("q") ?? undefined,
    });
    return NextResponse.json(reviews);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/reviews failed");
  }
}

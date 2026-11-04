import { NextResponse, type NextRequest } from "next/server";

import { reviewReplySchema } from "@/src/contracts/review-schema";
import { RemoveReviewReply, ReplyToReview } from "@/src/domain/use-cases/reviews/ReviewReplyCommands";
import { customerNotifier, reviewRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/reviews/:id/reply — post or edit the cafe's one public reply
 * under a review (`{ text }`). Requires `reviews.moderate`. 409
 * `REVIEW_NOT_APPROVED` for a review guests can't see; the guest is told the first
 * time a reply goes up.
 */
async function handlePut(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reviews.moderate");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = reviewReplySchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const review = await new ReplyToReview(reviewRepository, customerNotifier).execute(
      id,
      parsed.data.text,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(review);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/reviews/${id}/reply failed`);
  }
}

/** DELETE /api/admin/reviews/:id/reply — take the cafe's reply down. Requires `reviews.moderate`. */
async function handleDelete(_request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reviews.moderate");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  try {
    const review = await new RemoveReviewReply(reviewRepository).execute(id, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(review);
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/reviews/${id}/reply failed`);
  }
}

// The item pages read reviews uncached, but their rating rides on the cached menu;
// expiring it keeps every review-side write uniform.
export const PUT = invalidatesCatalog([CATALOG_TAGS.products], handlePut);
export const DELETE = invalidatesCatalog([CATALOG_TAGS.products], handleDelete);

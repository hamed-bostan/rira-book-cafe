import { NextResponse, type NextRequest } from "next/server";

import { moderateReviewSchema } from "@/src/contracts/review-schema";
import { ModerateReview } from "@/src/domain/use-cases/reviews/ReviewCommands";
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
 * PATCH /api/admin/reviews/:id — approve or reject a review. Requires
 * `reviews.moderate`. 409 when it changed in the meantime.
 */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("reviews.moderate");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = moderateReviewSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const review = await new ModerateReview(reviewRepository, customerNotifier).execute(
      id,
      parsed.data.status,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(review);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/reviews/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

import { NextResponse, type NextRequest } from "next/server";

import { submitReviewSchema } from "@/src/contracts/review-schema";
import { SubmitReview } from "@/src/domain/use-cases/reviews/ReviewCommands";
import { GetReviewEligibility } from "@/src/domain/use-cases/reviews/ReviewQueries";
import { productRepository, reviewRepository, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:id/reviews/mine — `{ canReview, review }`: whether the
 * signed-in guest has had the item, and the review they already wrote (or `null`).
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    return NextResponse.json(await new GetReviewEligibility(reviewRepository).execute(id, session.user.id));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id}/reviews/mine failed`);
  }
}

/**
 * PUT /api/products/:id/reviews/mine — write or rewrite the guest's review. It
 * waits for staff before it's shown. 409 `NOT_PURCHASED` when they haven't had it.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = submitReviewSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    // The name under the review comes from the account, never from the request.
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();
    const review = await new SubmitReview(reviewRepository, productRepository).execute(id, parsed.data, guest);
    return NextResponse.json(review);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/products/${id}/reviews/mine failed`);
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { pointsAdjustmentSchema } from "@/src/contracts/promotion-schema";
import { AdjustGuestPoints } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { loyaltyRepository, userRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

/**
 * POST /api/admin/loyalty/adjustments — add or take away a guest's points by hand,
 * with a reason. 201 with the movement; 404 for an unknown phone; 409
 * `NOT_ENOUGH_POINTS` when taking more than they have.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("promotions.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = pointsAdjustmentSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const movement = await new AdjustGuestPoints(loyaltyRepository, userRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/loyalty/adjustments failed");
  }
}

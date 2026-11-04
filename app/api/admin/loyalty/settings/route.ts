import { NextResponse, type NextRequest } from "next/server";

import { loyaltySettingsSchema } from "@/src/contracts/promotion-schema";
import { GetLoyaltySettings, UpdateLoyaltySettings } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { loyaltyRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/loyalty/settings — how points are earned and spent. Requires `promotions.write`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("promotions.write"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new GetLoyaltySettings(loyaltyRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/loyalty/settings failed");
  }
}

/**
 * PUT /api/admin/loyalty/settings — change how points are earned and spent, and how
 * long they last without activity (`pointsExpiryMonths`, 0 = never; left out, it
 * stays). Logged in the activity log.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("promotions.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = loyaltySettingsSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    return NextResponse.json(
      await new UpdateLoyaltySettings(loyaltyRepository).execute(parsed.data, {
        id: session.user.id,
        name: session.user.name ?? session.user.id,
      }),
    );
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/loyalty/settings failed");
  }
}

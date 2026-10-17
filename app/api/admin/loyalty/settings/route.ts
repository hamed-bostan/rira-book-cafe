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

/** PUT /api/admin/loyalty/settings — change how points are earned and spent. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("promotions.write"))) return unauthorizedResponse();

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
    return NextResponse.json(await new UpdateLoyaltySettings(loyaltyRepository).execute(parsed.data));
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/loyalty/settings failed");
  }
}

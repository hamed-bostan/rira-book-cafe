import { NextResponse, type NextRequest } from "next/server";

import { LookupGuestPoints } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { loyaltyRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/loyalty/guests?phone= — a guest's points by phone: balance and
 * recent movements. 404 when no account has that phone. Requires `promotions.write`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("promotions.write"))) return unauthorizedResponse();

  const phone = request.nextUrl.searchParams.get("phone")?.trim();
  if (!phone) return errorResponse(400, { message: "Enter a phone number.", code: "VALIDATION", fieldErrors: { phone: "phoneRequired" } });

  try {
    return NextResponse.json(await new LookupGuestPoints(loyaltyRepository, userRepository).execute(phone));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/loyalty/guests failed");
  }
}

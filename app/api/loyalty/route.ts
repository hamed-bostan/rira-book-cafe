import { NextResponse } from "next/server";

import { GetGuestLoyaltyOverview } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { loyaltyRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/loyalty — the signed-in guest's points: balance, recent movements, the
 * club's rules, and when the balance lapses (`expiresAt`) if the owner set an expiry.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new GetGuestLoyaltyOverview(loyaltyRepository).execute(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/loyalty failed");
  }
}

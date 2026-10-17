import { NextResponse } from "next/server";

import type { GuestLoyaltyOverview } from "@/src/domain/entities/Loyalty";
import { GetLoyaltySettings, GetOwnLoyaltyAccount } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { loyaltyRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/loyalty — the signed-in guest's points: balance, recent movements, and the club's rules. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    const [account, settings] = await Promise.all([
      new GetOwnLoyaltyAccount(loyaltyRepository).execute(session.user.id),
      new GetLoyaltySettings(loyaltyRepository).execute(),
    ]);
    const overview: GuestLoyaltyOverview = { ...account, settings };
    return NextResponse.json(overview);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/loyalty failed");
  }
}

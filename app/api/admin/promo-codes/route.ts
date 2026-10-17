import { NextResponse, type NextRequest } from "next/server";

import { promoCodeFormSchema } from "@/src/contracts/promotion-schema";
import { CreatePromoCode, ListPromoCodes } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { promotionRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/promo-codes — every code, newest first, with its live uses. Requires `promotions.write`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("promotions.write"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListPromoCodes(promotionRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/promo-codes failed");
  }
}

/** POST /api/admin/promo-codes — create a code. 201; 409 when the code is taken. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("promotions.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = promoCodeFormSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const promo = await new CreatePromoCode(promotionRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(promo, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/promo-codes failed");
  }
}

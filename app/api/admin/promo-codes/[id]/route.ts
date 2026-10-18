import { NextResponse, type NextRequest } from "next/server";

import { promoCodeActiveSchema, promoCodeFormSchema } from "@/src/contracts/promotion-schema";
import { SetPromoCodeActive, UpdatePromoCode } from "@/src/domain/use-cases/promotions/PromotionCommands";
import { promotionRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** PUT /api/admin/promo-codes/:id — replace a code's settings. Orders already placed keep their discount. */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("promotions.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
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
    const promo = await new UpdatePromoCode(promotionRepository).execute(id, parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(promo);
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/promo-codes/${id} failed`);
  }
}

/** PATCH /api/admin/promo-codes/:id — switch a code on or off. */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("promotions.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = promoCodeActiveSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That value isn't valid.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const promo = await new SetPromoCodeActive(promotionRepository).execute(id, parsed.data.isActive, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(promo);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/promo-codes/${id} failed`);
  }
}

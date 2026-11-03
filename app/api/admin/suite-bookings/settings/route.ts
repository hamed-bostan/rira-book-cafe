import { NextResponse, type NextRequest } from "next/server";

import { suiteRateSchema } from "@/src/contracts/booking-money-schema";
import { UpdateSuitePrice } from "@/src/domain/use-cases/suite-bookings/SuitePricing";
import { suitePricingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/suite-bookings/settings — what a night in the suite costs. Requires `dashboard.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await suitePricingRepository.getSettings());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/suite-bookings/settings failed");
  }
}

/**
 * PUT /api/admin/suite-bookings/settings — change what a night costs (`nightlyRate`)
 * for stays made from now on. Requires `accounting.write`, like the menu's pricing.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = suiteRateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const settings = await new UpdateSuitePrice(suitePricingRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/suite-bookings/settings failed");
  }
}

import { NextResponse } from "next/server";

import { GetSuiteAvailability } from "@/src/domain/use-cases/suite-bookings/SuiteBookingQueries";
import { suiteBookingRepository } from "@/src/infrastructure/container";
import { errorResponseFromException } from "@/src/lib/api/responses";

export const dynamic = "force-dynamic";

/** GET /api/suite-bookings/availability — the nights already held from today on. Public; carries no names. */
export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await new GetSuiteAvailability(suiteBookingRepository).execute(new Date()));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/suite-bookings/availability failed");
  }
}

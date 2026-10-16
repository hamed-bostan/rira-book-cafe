import { NextResponse } from "next/server";

import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { GetCashDay } from "@/src/domain/use-cases/cash/CashRegister";
import { cashRegisterRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ day: string }> };

/**
 * GET /api/admin/cash/days/:day — what the till should hold for a day: opening
 * float, cash in and out by kind, and the expected count. Managers only
 * (`accounting.view`): whoever counts the till does it blind.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { day } = await params;
  if (!isCafeDay(day)) return errorResponse(400, { message: "Expected a day as YYYY-MM-DD.", code: "VALIDATION", fieldErrors: { day: "dateInvalid" } });
  try {
    return NextResponse.json(await new GetCashDay(cashRegisterRepository).execute(day));
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/cash/days/${day} failed`);
  }
}

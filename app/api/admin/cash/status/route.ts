import { NextResponse } from "next/server";

import { GetCashCloseStatus } from "@/src/domain/use-cases/cash/CashRegister";
import { cashRegisterRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/cash/status — the last close and the past days with cash activity still not closed. Requires `cash.close`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("cash.close"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new GetCashCloseStatus(cashRegisterRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/cash/status failed");
  }
}

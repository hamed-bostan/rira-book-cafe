import { NextResponse, type NextRequest } from "next/server";

import { cashCloseSchema } from "@/src/contracts/cash-schema";
import { CloseCashRegister, ListCashCloses } from "@/src/domain/use-cases/cash/CashRegister";
import { cashRegisterRepository } from "@/src/infrastructure/container";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/cash/closes — the till's daily closes, newest first, paged. Requires `cash.close`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("cash.close"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListCashCloses(cashRegisterRepository).execute(parsePageRequest(request.nextUrl.searchParams, [])));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/cash/closes failed");
  }
}

/**
 * POST /api/admin/cash/closes — close the till for a day: the counted cash, any
 * deposit to the bank, a note. The over/short and deposit are posted with the close.
 * 409 `DAY_ALREADY_CLOSED` / `CLOSE_OUT_OF_ORDER` / `CASH_CHANGED`. Requires `cash.close`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("cash.close");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = cashCloseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const close = await new CloseCashRegister(cashRegisterRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(close, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/cash/closes failed");
  }
}

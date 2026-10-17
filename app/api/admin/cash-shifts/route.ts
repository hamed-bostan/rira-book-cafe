import { NextResponse, type NextRequest } from "next/server";

import { openCashShiftSchema } from "@/src/contracts/cash-shift-schema";
import { GetCurrentCashShift, ListCashShifts, OpenCashShift } from "@/src/domain/use-cases/cash-shifts/CashShiftCommands";
import { cashShiftRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cash-shifts — `{ current, recent }`: the open shift with its
 * figures so far (or `null`), and past shifts. Requires `shifts.manage`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("shifts.manage"))) return unauthorizedResponse();

  try {
    const [current, recent] = await Promise.all([
      new GetCurrentCashShift(cashShiftRepository).execute(new Date()),
      new ListCashShifts(cashShiftRepository).execute(),
    ]);
    return NextResponse.json({ current, recent });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/cash-shifts failed");
  }
}

/** POST /api/admin/cash-shifts — open a shift with a float. 201; 409 `SHIFT_ALREADY_OPEN`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("shifts.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = openCashShiftSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const shift = await new OpenCashShift(cashShiftRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/cash-shifts failed");
  }
}

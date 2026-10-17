import { NextResponse, type NextRequest } from "next/server";

import { closeCashShiftSchema } from "@/src/contracts/cash-shift-schema";
import { CloseCashShift } from "@/src/domain/use-cases/cash-shifts/CashShiftCommands";
import { cashShiftRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/cash-shifts/:id/close — count the drawer and close the shift.
 * Any difference is posted as cash over/short. 409 `NO_OPEN_SHIFT` when it's
 * already closed.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("shifts.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = closeCashShiftSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const shift = await new CloseCashShift(cashShiftRepository).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(shift);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/cash-shifts/${id}/close failed`);
  }
}

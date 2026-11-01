import { NextResponse, type NextRequest } from "next/server";

import { voidIncomeSchema } from "@/src/contracts/income-schema";
import { VoidIncome } from "@/src/domain/use-cases/income/IncomeCommands";
import { incomeRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/income/:id/void — void income entered by mistake or handed back;
 * its entry is reversed today, never deleted. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = voidIncomeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const income = await new VoidIncome(incomeRepository).execute(id, parsed.data.reason, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(income);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/income/${id}/void failed`);
  }
}

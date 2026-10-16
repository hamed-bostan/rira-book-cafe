import { NextResponse, type NextRequest } from "next/server";

import { ledgerAccountActiveSchema } from "@/src/contracts/accounting-schema";
import { SetLedgerAccountActive } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ code: string }> };

/**
 * PATCH /api/admin/accounting/accounts/:code — switch an account on or off. An
 * inactive account keeps its history but takes no new postings; system accounts
 * stay on. Requires `accounting.write`.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { code } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = ledgerAccountActiveSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Expected isActive.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const account = await new SetLedgerAccountActive(ledgerRepository).execute(code, parsed.data.isActive, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(account);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/accounting/accounts/${code} failed`);
  }
}

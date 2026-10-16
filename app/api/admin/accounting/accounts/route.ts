import { NextResponse, type NextRequest } from "next/server";

import { ledgerAccountSchema } from "@/src/contracts/accounting-schema";
import { CreateLedgerAccount } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/accounting/accounts — the chart of accounts, by code. Requires `accounting.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await ledgerRepository.listAccounts());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/accounts failed");
  }
}

/** POST /api/admin/accounting/accounts — add an account to the chart. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = ledgerAccountSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const account = await new CreateLedgerAccount(ledgerRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/accounting/accounts failed");
  }
}

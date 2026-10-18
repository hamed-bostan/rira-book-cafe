import { NextResponse, type NextRequest } from "next/server";

import { yearCloseSchema } from "@/src/contracts/inventory-schema";
import { CloseFiscalYear, ListFiscalYears } from "@/src/domain/use-cases/accounting/FiscalYearClose";
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

/** GET /api/admin/accounting/year-close — fiscal years with whether each has ended and been closed. Requires `accounting.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new ListFiscalYears(ledgerRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/year-close failed");
  }
}

/**
 * POST /api/admin/accounting/year-close — close a finished fiscal year: the year's
 * profit moves to retained earnings and the books lock through its last day.
 * Requires `accounting.write`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = yearCloseSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "That isn't a fiscal year.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const entry = await new CloseFiscalYear(ledgerRepository).execute(parsed.data.year, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/accounting/year-close failed");
  }
}

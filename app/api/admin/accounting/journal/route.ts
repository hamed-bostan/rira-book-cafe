import { NextResponse, type NextRequest } from "next/server";

import { manualEntrySchema } from "@/src/contracts/accounting-schema";
import { PostManualEntry } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
import { parseJournalFilters } from "@/src/lib/api/accounting-params";
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

/**
 * GET /api/admin/accounting/journal — journal entries, newest first, one page at a
 * time. Filters: `?from=&to=` (cafe days), `?source=`, `?account=` (entries touching
 * that account). Requires `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const page = await ledgerRepository.listEntries(parseJournalFilters(params), parsePageRequest(params, []));
    return NextResponse.json(page);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/journal failed");
  }
}

/** POST /api/admin/accounting/journal — post a manual entry. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = manualEntrySchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const entry = await new PostManualEntry(ledgerRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/accounting/journal failed");
  }
}

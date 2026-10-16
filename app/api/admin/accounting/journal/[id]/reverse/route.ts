import { NextResponse, type NextRequest } from "next/server";

import { reverseEntrySchema } from "@/src/contracts/accounting-schema";
import { ReverseJournalEntry } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
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
 * POST /api/admin/accounting/journal/:id/reverse — undo a manual entry by posting
 * its mirror image. Entries are never edited or deleted. Requires `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = reverseEntrySchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const reversal = await new ReverseJournalEntry(ledgerRepository).execute(id, parsed.data.date, parsed.data.reason, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(reversal, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/accounting/journal/${id}/reverse failed`);
  }
}

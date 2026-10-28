import { NextResponse, type NextRequest } from "next/server";

import { bookLoanUpdateSchema } from "@/src/contracts/book-loan-schema";
import {
  ChangeBookLoan,
  ExtendBookLoan,
  UndoBookLoanExtension,
} from "@/src/domain/use-cases/book-loans/ChangeBookLoan";
import { bookLoanRepository, bookWaitlistRepository, customerNotifier } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/book-loans/:id — mark a loan returned or lost (`status`), give
 * the borrower more time (`extendDays`), or take that back (`undoExtend`).
 * Requires `loans.manage`. 409 for a transition the workflow refuses, extending a
 * loan that's closed, or undoing an extension once the due date has moved on.
 */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("loans.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = bookLoanUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const staff = { id: session.user.id, name: session.user.name ?? session.user.id };
    const loan =
      parsed.data.status !== undefined
        ? await new ChangeBookLoan(bookLoanRepository, bookWaitlistRepository, customerNotifier).execute(
            id,
            parsed.data.status,
            staff,
            new Date(),
          )
        : parsed.data.undoExtend !== undefined
          ? await new UndoBookLoanExtension(bookLoanRepository).execute(id, parsed.data.undoExtend, staff)
          : // The schema guarantees exactly one of the three; a missing count fails the use-case's check.
            await new ExtendBookLoan(bookLoanRepository).execute(id, parsed.data.extendDays ?? 0, staff, new Date());
    return NextResponse.json(loan);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/book-loans/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

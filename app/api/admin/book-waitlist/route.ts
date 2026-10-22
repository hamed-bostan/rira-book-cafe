import { NextResponse, type NextRequest } from "next/server";

import { addBookHoldSchema } from "@/src/contracts/book-loan-schema";
import {
  AddToBookWaitlist,
  ListBookWaitlist,
  ListClosedBookWaitlist,
} from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookLoanRepository, bookWaitlistRepository, userRepository } from "@/src/infrastructure/container";
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
 * GET /api/admin/book-waitlist — everyone in line for a book, front of each line
 * first; `?view=closed` instead lists holds that closed (borrowed or cancelled)
 * in the last two months, newest first.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    const closed = request.nextUrl.searchParams.get("view") === "closed";
    return NextResponse.json(
      closed
        ? await new ListClosedBookWaitlist(bookWaitlistRepository).execute(new Date())
        : await new ListBookWaitlist(bookWaitlistRepository).execute(),
    );
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/book-waitlist failed");
  }
}

/**
 * POST /api/admin/book-waitlist — add a guest who asked at the counter or by phone
 * to a book's line. Requires `loans.manage`. 409 `BOOK_ON_SHELF` when a copy is
 * free and nobody waits (lend it instead), `ALREADY_WAITING` for a phone already in line.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("loans.manage"))) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = addBookHoldSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const entry = await new AddToBookWaitlist(bookWaitlistRepository, bookLoanRepository, userRepository).execute(
      parsed.data,
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/book-waitlist failed");
  }
}

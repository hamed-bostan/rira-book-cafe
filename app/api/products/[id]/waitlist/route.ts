import { NextResponse } from "next/server";

import { GetBookWaitlistStatus, JoinBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookLoanRepository, bookWaitlistRepository, userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/products/:id/waitlist — the book's line: `{ onLoan, queueLength, entry,
 * position }`. Public; `entry`/`position` are the signed-in guest's place, if any.
 */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const { id } = await params;
  try {
    const session = await getUserSession();
    const status = await new GetBookWaitlistStatus(bookWaitlistRepository, bookLoanRepository).execute(id, session?.user.id);
    return NextResponse.json(status);
  } catch (error) {
    return errorResponseFromException(error, `GET /api/products/${id}/waitlist failed`);
  }
}

/**
 * POST /api/products/:id/waitlist — join the line for a book that's out. 201 with
 * the entry. 409 `ALREADY_WAITING` when already in line, `BOOK_ON_SHELF` when no
 * copy is out.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    // Name and phone come from the account, never from the request.
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();
    const entry = await new JoinBookWaitlist(bookWaitlistRepository, bookLoanRepository).execute(id, guest);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/products/${id}/waitlist failed`);
  }
}

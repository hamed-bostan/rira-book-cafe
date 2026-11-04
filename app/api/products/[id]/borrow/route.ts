import { NextResponse } from "next/server";

import { BorrowBook } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import {
  bookLoanRepository,
  bookWaitlistRepository,
  customerNotifier,
  userRepository,
} from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/products/:id/borrow — borrow a copy that's free on the shelf: 201 with
 * the guest's hold, ready to collect (`notified`, with its `pickupBy`). Signed-in
 * guests only. 409 `NO_FREE_COPY` when every copy is out or held, or guests wait
 * for one (join the line instead), `ALREADY_WAITING` when they hold it or are in
 * line already, `ALREADY_ON_LOAN` when they have it out, `HOLD_LIMIT` when they
 * hold as many books as one guest may. 404 for something that isn't a book.
 */
export async function POST(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    // Name and phone come from the account, never from the request.
    const guest = await userRepository.getById(session.user.id);
    if (!guest) return unauthorizedResponse();
    const entry = await new BorrowBook(bookWaitlistRepository, bookLoanRepository, customerNotifier).execute(
      id,
      guest,
      new Date(),
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/products/${id}/borrow failed`);
  }
}

import { NextResponse } from "next/server";

import { LeaveBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookWaitlistRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/book-waitlist/:id — the guest leaves a book's line. 204. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await new LeaveBookWaitlist(bookWaitlistRepository).execute(id, session.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/book-waitlist/${id} failed`);
  }
}

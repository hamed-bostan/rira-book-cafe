import { NextResponse } from "next/server";

import { RemoveFromBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookWaitlistRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/admin/book-waitlist/:id — take a guest off a book's line. Requires `loans.manage`. 204. */
export async function DELETE(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("loans.manage"))) return unauthorizedResponse();

  const { id } = await params;
  try {
    await new RemoveFromBookWaitlist(bookWaitlistRepository).execute(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `DELETE /api/admin/book-waitlist/${id} failed`);
  }
}

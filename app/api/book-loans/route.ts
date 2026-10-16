import { NextResponse } from "next/server";

import { ListOwnBookLoans } from "@/src/domain/use-cases/book-loans/BookLoanQueries";
import { bookLoanRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/book-loans — the books the signed-in guest has borrowed, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListOwnBookLoans(bookLoanRepository).execute(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/book-loans failed");
  }
}

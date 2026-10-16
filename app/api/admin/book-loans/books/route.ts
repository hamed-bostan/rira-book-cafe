import { NextResponse } from "next/server";

import { ListLendableBooks } from "@/src/domain/use-cases/book-loans/BookLoanQueries";
import { bookLoanRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/book-loans/books — every book in the catalog, with how many copies are out. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListLendableBooks(bookLoanRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/book-loans/books failed");
  }
}

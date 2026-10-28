import { NextResponse } from "next/server";

import { CountBookLoans } from "@/src/domain/use-cases/book-loans/BookLoanQueries";
import { bookLoanRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/book-loans/counts — how many loans each view holds (open, overdue,
 * returned, lost, all), over every loan whatever the search. Readable by anyone
 * with the dashboard.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new CountBookLoans(bookLoanRepository).execute(new Date()));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/book-loans/counts failed");
  }
}

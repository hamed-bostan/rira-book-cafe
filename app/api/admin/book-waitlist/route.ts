import { NextResponse } from "next/server";

import { ListBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookWaitlistRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/book-waitlist — everyone in line for a book, front of each line first. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListBookWaitlist(bookWaitlistRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/book-waitlist failed");
  }
}

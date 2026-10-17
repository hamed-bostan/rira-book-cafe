import { NextResponse } from "next/server";

import { ListOwnBookWaitlist } from "@/src/domain/use-cases/book-loans/BookWaitlist";
import { bookWaitlistRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getUserSession } from "@/src/lib/require-auth";

export const dynamic = "force-dynamic";

/** GET /api/book-waitlist — the books the signed-in guest is (or was) waiting for, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getUserSession();
  if (!session?.user.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await new ListOwnBookWaitlist(bookWaitlistRepository).execute(session.user.id));
  } catch (error) {
    return errorResponseFromException(error, "GET /api/book-waitlist failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { lendHoldSchema } from "@/src/contracts/book-loan-schema";
import { LendBook, LendHeldBook } from "@/src/domain/use-cases/book-loans/LendBook";
import {
  bookLoanRepository,
  bookWaitlistRepository,
  customerNotifier,
  userRepository,
} from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/book-waitlist/:id/lend — "Lend now": hand the told guest the
 * book held for them, with `{ dueOn, note?, depositAmount?, depositMethod? }` —
 * the terms the Lend dialog takes, the guest being the hold's. Requires
 * `loans.manage`. 201 with the loan; the hold is fulfilled. 409 `HOLD_NOT_READY`
 * once the hold isn't theirs to collect any more, `ALREADY_ON_LOAN` when they have
 * the book out already.
 */
async function handlePost(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("loans.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = lendHoldSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  const { id } = await params;
  try {
    const lendBook = new LendBook(bookLoanRepository, userRepository, customerNotifier);
    const loan = await new LendHeldBook(bookWaitlistRepository, lendBook).execute(
      id,
      parsed.data,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/book-waitlist/${id}/lend failed`);
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

import { NextResponse, type NextRequest } from "next/server";

import { bookLoanUpdateSchema } from "@/src/contracts/book-loan-schema";
import { ChangeBookLoan } from "@/src/domain/use-cases/book-loans/ChangeBookLoan";
import { bookLoanRepository, bookWaitlistRepository, customerNotifier } from "@/src/infrastructure/container";
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
 * PATCH /api/admin/book-loans/:id — mark a loan returned or lost. Requires
 * `loans.manage`. 409 for a transition the workflow refuses.
 */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("loans.manage");
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = bookLoanUpdateSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const loan = await new ChangeBookLoan(bookLoanRepository, bookWaitlistRepository, customerNotifier).execute(
      id,
      parsed.data.status,
      { id: session.user.id, name: session.user.name ?? session.user.id },
      new Date(),
    );
    return NextResponse.json(loan);
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/book-loans/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

import { NextResponse, type NextRequest } from "next/server";

import { lendBookSchema } from "@/src/contracts/book-loan-schema";
import { BOOK_LOAN_VIEWS, type BookLoanView } from "@/src/domain/repositories/IBookLoanRepository";
import { ListBookLoans } from "@/src/domain/use-cases/book-loans/BookLoanQueries";
import { LendBook } from "@/src/domain/use-cases/book-loans/LendBook";
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

export const dynamic = "force-dynamic";

const VIEW_SET = new Set<string>(BOOK_LOAN_VIEWS);

/**
 * GET /api/admin/book-loans — the lending book. `?view=` open (default) | overdue |
 * returned | lost | all, and optional `?q=` (borrower name or phone, or book title).
 * Readable by anyone with the dashboard.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const view = params.get("view") ?? "open";
  if (!VIEW_SET.has(view)) return errorResponse(400, { message: "Unknown view.", code: "VALIDATION" });

  try {
    const loans = await new ListBookLoans(bookLoanRepository).execute(
      { view: view as BookLoanView, q: params.get("q") ?? undefined },
      new Date(),
    );
    return NextResponse.json(loans);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/book-loans failed");
  }
}

/**
 * POST /api/admin/book-loans — record a book handed to a guest. Requires
 * `loans.manage`. 201 with the loan; 409 `ALREADY_ON_LOAN` when that borrower
 * already has the book.
 */
async function handlePost(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("loans.manage");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });

  const parsed = lendBookSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const loan = await new LendBook(
      bookLoanRepository,
      userRepository,
      bookWaitlistRepository,
      customerNotifier,
    ).execute(parsed.data, { id: session.user.id, name: session.user.name ?? session.user.id }, new Date());
    return NextResponse.json(loan, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/book-loans failed");
  }
}

export const POST = invalidatesCatalog([CATALOG_TAGS.products], handlePost);

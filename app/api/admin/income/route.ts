import { NextResponse, type NextRequest } from "next/server";

import { incomeSchema } from "@/src/contracts/income-schema";
import { INCOME_STATUSES, type IncomeStatus } from "@/src/domain/entities/Income";
import { GetIncomeSummary, RecordIncome } from "@/src/domain/use-cases/income/IncomeCommands";
import { incomeRepository, ledgerRepository } from "@/src/infrastructure/container";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/income — money received outside orders, newest first, one page at a
 * time, plus this month's figures. `?status=` and a search `?q=` (description, payer
 * or number). Requires `accounting.view`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const [page, summary] = await Promise.all([
      incomeRepository.listIncomes(
        {
          status: (INCOME_STATUSES as readonly string[]).includes(status ?? "") ? (status as IncomeStatus) : undefined,
          query: params.get("q")?.trim() || undefined,
        },
        parsePageRequest(params, []),
      ),
      new GetIncomeSummary(incomeRepository).execute(),
    ]);
    return NextResponse.json({ ...page, summary });
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/income failed");
  }
}

/** POST /api/admin/income — record money in and book it. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = incomeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const income = await new RecordIncome(incomeRepository, ledgerRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(income, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/income failed");
  }
}

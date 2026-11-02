import { NextResponse } from "next/server";

import { ledgerRepository, payrollRepository } from "@/src/infrastructure/container";
import { errorResponse, errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/admin/payroll/runs/:id — one pay run and the journal entries it posted. Requires `payroll.manage`. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("payroll.manage"))) return unauthorizedResponse();
  const { id } = await params;
  try {
    const [run, entries] = await Promise.all([payrollRepository.getRun(id), ledgerRepository.entriesFor(id)]);
    if (!run) return errorResponse(404, { message: "Pay run not found.", code: "NOT_FOUND" });
    return NextResponse.json({ run, entries });
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/payroll/runs/${id} failed`);
  }
}

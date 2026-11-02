import { NextResponse } from "next/server";

import { DraftPayRun } from "@/src/domain/use-cases/payroll/DraftPayRun";
import { payrollRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/payroll/runs/draft — what a new pay run starts from: the recent
 * months nobody has recorded, and everyone active on last month's figures. Requires
 * `payroll.manage`.
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("payroll.manage"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new DraftPayRun(payrollRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/payroll/runs/draft failed");
  }
}

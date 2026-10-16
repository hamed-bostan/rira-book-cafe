import { NextResponse } from "next/server";

import { GetPricingReport } from "@/src/domain/use-cases/pricing/PricingCommands";
import { ledgerRepository, pricingRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/pricing — every menu item's ingredient cost, overhead share, profit
 * target and suggested price, with the overhead basis. Requires `accounting.view`
 * (costs are the cafe's business).
 */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await new GetPricingReport(pricingRepository, ledgerRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/pricing failed");
  }
}

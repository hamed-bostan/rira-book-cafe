import { NextResponse, type NextRequest } from "next/server";

import { applyPriceSchema } from "@/src/contracts/pricing-schema";
import { ApplySuggestedPrice } from "@/src/domain/use-cases/pricing/PricingCommands";
import { ledgerRepository, pricingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith, sessionHas } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/pricing/items/:id/apply — set the item's menu price to the
 * suggestion, recomputed server-side. Changes the menu, so it needs `catalog.write`
 * as well as `accounting.write`.
 */
export async function POST(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session || !(await sessionHas(session, "catalog.write"))) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = applyPriceSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Expected the current price.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const repriced = await new ApplySuggestedPrice(pricingRepository, ledgerRepository).execute(id, parsed.data.expectedPrice, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(repriced);
  } catch (error) {
    return errorResponseFromException(error, `POST /api/admin/pricing/items/${id}/apply failed`);
  }
}

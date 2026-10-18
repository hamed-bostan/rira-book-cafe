import { NextResponse, type NextRequest } from "next/server";

import { gatewaySettlementSchema } from "@/src/contracts/payment-schema";
import { RecordGatewaySettlement } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

/**
 * POST /api/admin/accounting/settlements — record a payout from the online
 * gateway: Dr Bank (deposited), Dr Bank & gateway fees (fee) / Cr Gateway clearing.
 * 400 when it would clear more than the gateway holds. Requires `accounting.write`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = gatewaySettlementSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const entry = await new RecordGatewaySettlement(ledgerRepository).execute(parsed.data, {
      id: session.user.id,
      name: session.user.name ?? session.user.id,
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/accounting/settlements failed");
  }
}

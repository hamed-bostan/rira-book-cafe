import { NextResponse, type NextRequest } from "next/server";

import { accountingSettingsSchema } from "@/src/contracts/accounting-schema";
import { UpdateAccountingSettings } from "@/src/domain/use-cases/accounting/LedgerCommands";
import { ledgerRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/accounting/settings — the VAT rate and the period lock. Requires `accounting.view`. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(await ledgerRepository.getSettings());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/accounting/settings failed");
  }
}

/** PUT /api/admin/accounting/settings — change the VAT rate or close the books through a day. Requires `accounting.write`. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = accountingSettingsSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const settings = await new UpdateAccountingSettings(ledgerRepository).execute(
      { vatRateBps: parsed.data.vatRate, booksClosedThrough: parsed.data.booksClosedThrough },
      { id: session.user.id, name: session.user.name ?? session.user.id },
    );
    return NextResponse.json(settings);
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/accounting/settings failed");
  }
}

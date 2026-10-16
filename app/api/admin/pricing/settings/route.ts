import { NextResponse, type NextRequest } from "next/server";

import { pricingSettingsSchema } from "@/src/contracts/pricing-schema";
import { UpdatePricingSettings } from "@/src/domain/use-cases/pricing/PricingCommands";
import { pricingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

/** PUT /api/admin/pricing/settings — default profit, rounding, and where overhead comes from. Requires `accounting.write`. */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.write"))) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = pricingSettingsSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    const { defaultMarkup, ...rest } = parsed.data;
    return NextResponse.json(await new UpdatePricingSettings(pricingRepository).execute({ ...rest, defaultMarkupBps: defaultMarkup }));
  } catch (error) {
    return errorResponseFromException(error, "PUT /api/admin/pricing/settings failed");
  }
}

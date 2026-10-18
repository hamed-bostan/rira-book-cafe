import { NextResponse, type NextRequest } from "next/server";

import { ingredientSchema } from "@/src/contracts/pricing-schema";
import { SaveIngredient } from "@/src/domain/use-cases/pricing/PricingCommands";
import { pricingRepository } from "@/src/infrastructure/container";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/ingredients — ingredients by name; `?all=true` includes inactive ones. Requires `accounting.view`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  try {
    return NextResponse.json(
      await pricingRepository.listIngredients(request.nextUrl.searchParams.get("all") === "true"),
    );
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/ingredients failed");
  }
}

/** POST /api/admin/ingredients — add an ingredient. Requires `accounting.write`. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.write"))) return unauthorizedResponse();

  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = ingredientSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    const { isActive: _isActive, ...input } = parsed.data;
    return NextResponse.json(await new SaveIngredient(pricingRepository).create(input), { status: 201 });
  } catch (error) {
    return errorResponseFromException(error, "POST /api/admin/ingredients failed");
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { recipeSchema } from "@/src/contracts/pricing-schema";
import { SaveRecipe } from "@/src/domain/use-cases/pricing/PricingCommands";
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

type RouteContext = { params: Promise<{ productId: string }> };

/** GET /api/admin/recipes/:productId — the item's recipe lines. Requires `accounting.view`. */
export async function GET(_request: Request, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.view"))) return unauthorizedResponse();
  const { productId } = await params;
  try {
    return NextResponse.json({ lines: await pricingRepository.getRecipe(productId) });
  } catch (error) {
    return errorResponseFromException(error, `GET /api/admin/recipes/${productId} failed`);
  }
}

/** PUT /api/admin/recipes/:productId — replace the recipe; the item's cost price follows. Requires `accounting.write`. */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.write"))) return unauthorizedResponse();

  const { productId } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = recipeSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, { message: "Please fix the highlighted fields.", code: "VALIDATION", fieldErrors: firstFieldErrors(parsed.error) });
  }

  try {
    return NextResponse.json({ lines: await new SaveRecipe(pricingRepository).execute(productId, parsed.data.lines) });
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/recipes/${productId} failed`);
  }
}

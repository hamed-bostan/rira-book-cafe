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

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PUT /api/admin/ingredients/:id — edit an ingredient (a new purchase price re-costs
 * every recipe using it) or switch it off. Requires `accounting.write`.
 */
export async function PUT(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const session = await getSessionWith("accounting.write");
  if (!session) return unauthorizedResponse();
  const actor = { id: session.user.id, name: session.user.name ?? session.user.id };

  const { id } = await params;
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
    return NextResponse.json(await new SaveIngredient(pricingRepository).update(id, parsed.data, actor));
  } catch (error) {
    return errorResponseFromException(error, `PUT /api/admin/ingredients/${id} failed`);
  }
}

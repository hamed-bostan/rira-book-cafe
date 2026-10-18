import { NextResponse, type NextRequest } from "next/server";

import { itemMarkupSchema } from "@/src/contracts/pricing-schema";
import { SetItemMarkup } from "@/src/domain/use-cases/pricing/PricingCommands";
import { pricingRepository } from "@/src/infrastructure/container";
import { invalidatesCatalog } from "@/src/lib/api/invalidatesCatalog";
import {
  errorResponse,
  errorResponseFromException,
  firstFieldErrors,
  parseJsonBody,
  unauthorizedResponse,
} from "@/src/lib/api/responses";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";
import { getSessionWith } from "@/src/lib/require-permission";

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/admin/pricing/items/:id — set an item's own profit %, or clear it (blank). Requires `accounting.write`. */
async function handlePatch(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  if (!(await getSessionWith("accounting.write"))) return unauthorizedResponse();

  const { id } = await params;
  const body = await parseJsonBody(request);
  if (!body.ok) return errorResponse(400, { message: "Expected a JSON body.", code: "BAD_REQUEST" });
  const parsed = itemMarkupSchema.safeParse(body.data);
  if (!parsed.success) {
    return errorResponse(400, {
      message: "Please fix the highlighted fields.",
      code: "VALIDATION",
      fieldErrors: firstFieldErrors(parsed.error),
    });
  }

  try {
    await new SetItemMarkup(pricingRepository).execute(id, parsed.data.markup);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponseFromException(error, `PATCH /api/admin/pricing/items/${id} failed`);
  }
}

export const PATCH = invalidatesCatalog([CATALOG_TAGS.products], handlePatch);

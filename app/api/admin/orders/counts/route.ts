import { NextResponse } from "next/server";

import { GetOrderStatusCounts } from "@/src/domain/use-cases/orders/OrderQueries";
import { orderRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/** GET /api/admin/orders/counts — orders per status (plus `active`), unfiltered, for the status tabs. */
export async function GET(): Promise<NextResponse> {
  if (!(await getSessionWith("dashboard.view"))) return unauthorizedResponse();

  try {
    return NextResponse.json(await new GetOrderStatusCounts(orderRepository).execute());
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/orders/counts failed");
  }
}

import { NextResponse } from "next/server";

import { ListActivityActors } from "@/src/domain/use-cases/activity/ListActivityActors";
import { activityLog } from "@/src/infrastructure/container";
import { visibleActivityEntityTypes } from "@/src/lib/api/activity-visibility";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { isOwner } from "@/src/lib/require-admin";
import { getSessionWith } from "@/src/lib/require-permission";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/activity/actors — everyone who appears in the activity log, by
 * name, for the page's actor filter. Admin only.
 *
 * A sub-resource rather than a field on the log's own response: the options
 * describe the *whole* log and don't change as you page through it, so folding
 * them into every page would re-send the same list with each request (and, worse,
 * invite someone to build them from the page's rows — which would offer only the
 * people who happen to appear on the page you're already looking at).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSessionWith("activity.view");
  if (!session) return unauthorizedResponse();

  try {
    // Scoped the same way the log itself is, so the dropdown can't name someone
    // whose only entries are ones this viewer isn't allowed to read.
    const actors = await new ListActivityActors(activityLog).execute(
      visibleActivityEntityTypes(await isOwner(session)),
    );
    return NextResponse.json(actors);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/activity/actors failed");
  }
}

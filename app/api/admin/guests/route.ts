import { NextResponse, type NextRequest } from "next/server";

import { GUEST_PROFILE_PERMISSIONS } from "@/src/domain/entities/GuestProfile";
import { FindGuestProfile } from "@/src/domain/use-cases/guest-profiles/FindGuestProfile";
import { userRepository } from "@/src/infrastructure/container";
import { errorResponseFromException, unauthorizedResponse } from "@/src/lib/api/responses";
import { getSessionWithAny } from "@/src/lib/require-permission";

/** What this route promises — `guestLookupResponseSchema`, beside `GuestField`, holds the client to it. */
type GuestLookupBody = { found: false } | { found: true; name: string | null; signedIn: boolean };

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/guests?phone= — whose profile a guest's phone is, for the staff
 * form about to record something for them: `{ found: false }`, or `{ found: true,
 * name, signedIn }` (`name` is `null` while the guest hasn't given one). Never
 * anything more from the profile. 400 `phoneInvalid` for a number nobody could
 * have. For staff who record things for guests (`GUEST_PROFILE_PERMISSIONS`).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await getSessionWithAny(GUEST_PROFILE_PERMISSIONS))) return unauthorizedResponse();

  try {
    const match = await new FindGuestProfile(userRepository).execute(request.nextUrl.searchParams.get("phone") ?? "");
    const body: GuestLookupBody = match
      ? { found: true, name: match.name, signedIn: match.signedIn }
      : { found: false };
    return NextResponse.json(body);
  } catch (error) {
    return errorResponseFromException(error, "GET /api/admin/guests failed");
  }
}

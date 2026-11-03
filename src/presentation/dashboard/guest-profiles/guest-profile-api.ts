import type { GuestProfileMatch } from "@/src/domain/entities/GuestProfile";
import { apiGet } from "@/src/lib/api/client";

import { guestLookupResponseSchema } from "./guest-lookup-response-schema";

/** Typed client for looking a guest up by phone, for the staff forms that record something for one. */
export const guestProfilesApi = {
  /**
   * Whose profile `phone` is — its name (`null` while the guest hasn't given one)
   * and whether they've signed in — or `null` when it has none yet. `signal`
   * cancels a lookup a newer number has overtaken.
   */
  async getByPhone(phone: string, signal?: AbortSignal): Promise<GuestProfileMatch | null> {
    const result = await apiGet("/admin/guests", guestLookupResponseSchema, { params: { phone }, signal });
    return result.found ? { name: result.name, signedIn: result.signedIn } : null;
  },
};

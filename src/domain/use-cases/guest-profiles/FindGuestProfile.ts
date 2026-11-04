import { guestProfileMatch, type GuestProfileMatch } from "../../entities/GuestProfile";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { ValidationError } from "../../errors/ValidationError";

import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Look a guest up by the phone they gave staff: whose profile it is, if anyone's,
 * and whether they've signed in to it — so the form can say "has a profile" or
 * ask for a new guest's name before the record is saved. `null` when the phone has
 * no profile yet. Only the name is told, never anything else on the profile.
 */
export class FindGuestProfile {
  constructor(private readonly userRepo: Pick<IUserRepository, "getById">) {}

  async execute(phone: string): Promise<GuestProfileMatch | null> {
    if (!isPlausiblePhone(phone)) throw new ValidationError("phone", "phoneInvalid");
    const profile = await this.userRepo.getById(normalizePhone(phone));
    return profile ? guestProfileMatch(profile) : null;
  }
}

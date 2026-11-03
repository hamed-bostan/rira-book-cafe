import {
  guestProfileName,
  MAX_GUEST_PROFILE_NAME_LENGTH,
  type GuestInput,
  type RecordGuest,
} from "../../entities/GuestProfile";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import { ValidationError } from "../../errors/ValidationError";

import type { ActivityActor } from "../../entities/ActivityEntry";
import type { IUserRepository } from "../../repositories/IUserRepository";

/** What the record's form calls the guest's two fields, so a refusal lands on the right one. */
export type GuestFieldNames = {
  phone: string;
  name: string;
};

const GUEST_FIELDS: GuestFieldNames = { phone: "guestPhone", name: "guestName" };

/**
 * Work out whose profile a record staff are making for a guest belongs to, from
 * the phone the guest gave:
 * - a phone that can't be anyone's is refused;
 * - a phone with a profile is that profile, under its own name (the name staff
 *   typed only stands in while the profile has none);
 * - a phone with no profile needs the guest's name, and comes back with the
 *   profile to make (`newProfile`).
 *
 * Nothing is written here. The record's repository makes the new profile in the
 * same transaction as the record, so neither can exist without the other — a
 * booking that's refused (a table taken, a book sold out) leaves no profile behind.
 * Messages are `formErrors` keys.
 */
export class ResolveGuestProfile {
  constructor(private readonly userRepo: Pick<IUserRepository, "getById">) {}

  async execute(input: GuestInput, staff: ActivityActor, fields: GuestFieldNames = GUEST_FIELDS): Promise<RecordGuest> {
    const phone = input.phone.trim();
    if (!isPlausiblePhone(phone)) throw new ValidationError(fields.phone, "phoneInvalid");
    const typedName = input.name?.trim() || undefined;
    if (typedName && typedName.length > MAX_GUEST_PROFILE_NAME_LENGTH) {
      throw new ValidationError(fields.name, "nameTooLong");
    }

    const id = normalizePhone(phone);
    const profile = await this.userRepo.getById(id);
    if (profile) {
      const name = guestProfileName(profile) ?? typedName;
      if (!name) throw new ValidationError(fields.name, "guestNameNeeded");
      return { userId: profile.id, name, phone };
    }
    if (!typedName) throw new ValidationError(fields.name, "guestNameNeeded");
    return { userId: id, name: typedName, phone, newProfile: { id, phone, name: typedName, createdBy: staff } };
  }
}

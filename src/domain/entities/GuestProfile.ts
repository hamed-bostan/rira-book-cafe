import { singleChange, type ActivityActor, type NewActivityEntry } from "./ActivityEntry";
import { PLACEHOLDER_USER_NAME, type User } from "./User";

import type { Permission } from "./Permission";

/**
 * A guest profile: the `User` every booking, stay, loan, hold and order belongs
 * to. Its id is the guest's normalized phone (`normalizePhone`), so whoever signs
 * in with that number later lands in it and finds everything already there.
 *
 * Guests make their own by signing in. Staff acting for a guest — at the counter,
 * on the phone — give the guest's phone instead: its profile is found, or, when
 * there's none yet, made on the spot from the name the guest gives, in the same
 * transaction as the record it's for (`ResolveGuestProfile`). No record is just a
 * typed name and phone.
 */

/**
 * Who on the team may look a guest up by phone, and so make them a profile:
 * whoever records something for guests — a sale, a booking or stay, a loan or hold.
 */
export const GUEST_PROFILE_PERMISSIONS = [
  "orders.fulfill",
  "reservations.manage",
  "loans.manage",
] as const satisfies readonly Permission[];

/** The longest name a profile takes — what a guest's own profile form allows. */
export const MAX_GUEST_PROFILE_NAME_LENGTH = 80;

/** The longest phone staff may type for a guest, separators and all. */
export const MAX_GUEST_PHONE_LENGTH = 30;

/** A guest as staff give one for a record: the phone, and a name for a phone with no profile yet. */
export type GuestInput = {
  phone: string;
  name?: string;
};

/** A profile staff are making for a guest, written in the transaction of the record it's made with. */
export type NewGuestProfile = {
  /** The guest's normalized phone: the profile's id. */
  id: string;
  /** The phone as staff typed it. */
  phone: string;
  name: string;
  /** The staff member making it. */
  createdBy: ActivityActor;
};

/** The guest a record is for: a profile found by the phone, or one about to be made with the record. */
export type RecordGuest = {
  /** The record's `userId`. */
  userId: string;
  /** The name the record keeps. */
  name: string;
  /** The phone the record keeps, as typed. */
  phone: string;
  /** The profile to make with the record, when the phone had none. */
  newProfile?: NewGuestProfile;
};

/**
 * What looking a phone up tells staff, and never more: the name its profile goes
 * by (`null` while the guest hasn't given one) and whether its guest has signed in.
 */
export type GuestProfileMatch = {
  name: string | null;
  signedIn: boolean;
};

/**
 * The name a profile goes by, or `null` while it has only the placeholder a first
 * sign-in gives — staff are asked for a name then, rather than booking "Rira Guest".
 */
export function guestProfileName(user: Pick<User, "name">): string | null {
  const name = user.name.trim();
  return name && name !== PLACEHOLDER_USER_NAME ? name : null;
}

/** A profile as a phone lookup shows it to staff. */
export function guestProfileMatch(user: Pick<User, "name" | "firstSignedInAt">): GuestProfileMatch {
  return { name: guestProfileName(user), signedIn: user.firstSignedInAt !== undefined };
}

/** The activity entry for a profile staff made: who made it, for which guest. */
export function guestProfileCreatedEntry(profile: NewGuestProfile): NewActivityEntry {
  return {
    actorId: profile.createdBy.id,
    actorName: profile.createdBy.name,
    action: "guest.profileCreated",
    entityType: "guest",
    entityId: profile.id,
    entityLabel: profile.name,
    changes: singleChange("name", null, profile.name),
  };
}

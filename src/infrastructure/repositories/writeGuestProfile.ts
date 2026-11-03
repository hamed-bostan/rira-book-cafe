import { guestProfileCreatedEntry, type NewGuestProfile } from "@/src/domain/entities/GuestProfile";
import type { Prisma } from "@/src/infrastructure/prisma/generated/client";

import { toActivityRow } from "./writeActivityEntry";

/**
 * Make the profile staff are making for a guest, inside the transaction of the
 * record it's made with — so a record never stands without its profile, and a
 * refused one (a table taken, a book sold out) leaves no profile behind. Logs
 * `guest.profileCreated` with it. A no-op without one.
 *
 * Every repository that saves a record for a guest calls this first thing in its
 * transaction, with the `newGuest` `ResolveGuestProfile` worked out.
 *
 * If the phone got a profile meanwhile — the guest signed in, or another member of
 * staff got there first — that one stands: nothing is made or logged, and the
 * record is attached to it all the same (its id is the phone either way).
 */
export async function createGuestProfile(
  tx: Prisma.TransactionClient,
  profile: NewGuestProfile | undefined,
): Promise<void> {
  if (!profile) return;
  const { count } = await tx.user.createMany({
    data: [{ id: profile.id, phone: profile.phone, name: profile.name, createdById: profile.createdBy.id }],
    skipDuplicates: true,
  });
  if (count > 0) await tx.activityEntry.create({ data: toActivityRow(guestProfileCreatedEntry(profile)) });
}

import type { GuestLookup } from "./useGuestLookup";

/**
 * The guest a staff form records something for, as `GuestField` hands it over:
 * the phone, and — only when the phone has no profile yet, or one with no name —
 * the name to make it with. Send both to the endpoint as they are (the counter
 * sale's `customerPhone`/`customerName`, a booking's `guestPhone`/`guestName`):
 * the server finds the profile again and makes a new one in the same transaction
 * as the record.
 */
export type GuestFieldValue = {
  phone: string;
  name?: string;
};

/**
 * What the form can save with, given the phone and name typed and what looking the
 * phone up said — `null` while that isn't enough: a number still being typed or
 * looked up, or a guest with no name to go by (no profile, or one with no name).
 */
export function guestFieldValue(phone: string, name: string, lookup: GuestLookup | null): GuestFieldValue | null {
  const typedPhone = phone.trim();
  const typedName = name.trim() || undefined;
  switch (lookup?.state) {
    case "found":
      if (lookup.match.name !== null) return { phone: typedPhone };
      return typedName ? { phone: typedPhone, name: typedName } : null;
    case "new":
      return typedName ? { phone: typedPhone, name: typedName } : null;
    // The server looks the phone up anyway; a name typed in case it's new comes along.
    case "failed":
      return { phone: typedPhone, name: typedName };
    default:
      return null;
  }
}

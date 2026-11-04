import { MAX_GUEST_PHONE_LENGTH, MAX_GUEST_PROFILE_NAME_LENGTH } from "@/src/domain/entities/GuestProfile";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import * as z from "@/src/lib/zod";

/**
 * The guest a staff form records something for, as `GuestField` hands it over —
 * the fields every such contract (a counter sale, a table booking, a suite stay)
 * spreads in under its own names. Messages are `formErrors` keys.
 */

/** The guest's phone, which finds their profile: required, and a number someone could have. */
export const guestPhoneField = z
  .string({ error: "phoneRequired" })
  .check(
    z.trim(),
    z.minLength(1, "phoneRequired"),
    z.maxLength(MAX_GUEST_PHONE_LENGTH, "phoneInvalid"),
    z.refine(isPlausiblePhone, "phoneInvalid"),
  );

/**
 * The guest's name, for a phone with no profile yet: trimmed, blank → `undefined`.
 * Whether it's needed is the server's to say — only it knows the phone has no profile.
 */
export const guestNameField = z.pipe(
  z.optional(z.string().check(z.trim(), z.maxLength(MAX_GUEST_PROFILE_NAME_LENGTH, "nameTooLong"))),
  z.transform((value) => (value ? value : undefined)),
);

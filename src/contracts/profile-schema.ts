import * as z from "@/src/lib/zod";

/**
 * A guest's own profile edit, shared by the account form and `PUT /api/profile`.
 * Identity (id/phone) comes from the session and can't change here. The name is
 * what staff see on orders and bookings, so it's required. Messages are
 * `formErrors` keys.
 */
export const profileUpdateSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(80, "nameTooLong")),
  /** Optional; a blank field clears it. */
  email: z.union([
    z.string().check(z.trim(), z.email("emailInvalid"), z.maxLength(120, "emailTooLong")),
    z.literal(""),
  ]),
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

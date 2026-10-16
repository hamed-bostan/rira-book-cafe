import { z } from "zod";

/**
 * A guest's own profile edit, shared by the account form and `PUT /api/profile`.
 * Identity (id/phone) comes from the session and can't change here. The name is
 * what staff see on orders and bookings, so it's required. Messages are
 * `formErrors` keys.
 */
export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80, "nameTooLong"),
  /** Optional; a blank field clears it. */
  email: z.union([z.string().trim().email("emailInvalid").max(120, "emailTooLong"), z.literal("")]),
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

/** What `GET/PUT /api/profile` returns. */
export const profileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
});

export type ProfileWire = z.infer<typeof profileResponseSchema>;

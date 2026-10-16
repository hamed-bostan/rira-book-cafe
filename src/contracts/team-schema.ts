import { z } from "zod";

import { GRANTABLE_ROLES } from "@/src/domain/entities/User";

/**
 * The single source of truth for granting dashboard access, shared by the client form
 * (React Hook Form resolver) and the REST route handler (defensive re-validation —
 * never trust the client). Framework-free, so it stays importable from both.
 * Validation messages are `formErrors` message keys, translated at display time
 * (see `src/lib/formErrorMessage.ts`).
 *
 * The phone is required and the email is not, because the number *is* the
 * invitation: a user's id is their normalized phone and sign-in is OTP on that
 * number, so granting the role to a phone can only ever be redeemed by whoever
 * holds the SIM. The email only says where to *send* the invitation — a typo
 * there costs an undelivered note, not a stranger with admin rights.
 */
export const grantAdminSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "phoneRequired")
    // Digits, spaces and the usual separators — normalization to canonical digits
    // happens in the domain (see `normalizePhone`), so the form stays permissive
    // about how the number is typed (+98…, 98…, 09…).
    .regex(/^[+\d][\d\s()-]{7,19}$/, "phoneInvalid"),
  email: z
    .string()
    .trim()
    .email("emailInvalid")
    .max(254, "emailTooLong")
    .optional()
    .or(z.literal("")),
  /**
   * Which job they're being given. `owner` isn't offered: there is exactly one,
   * and it moves by transfer rather than by grant — see `TransferOwnership`.
   */
  role: z.enum(GRANTABLE_ROLES),
});

/** Form value shape, and the validated payload the route forwards to the use-case. */
export type GrantAdminInput = z.infer<typeof grantAdminSchema>;

import { isTeamPhone } from "@/src/domain/entities/Phone";
import { GRANTABLE_ROLES } from "@/src/domain/entities/User";
import * as z from "@/src/lib/zod";

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
  phone: z.string().check(
    z.trim(),
    z.minLength(1, "phoneRequired"),
    // A complete Iranian mobile however it's typed (09…, +98…, 98…, spaced, in
    // Persian digits), or a foreign number with its "+" — see `isTeamPhone`.
    // Normalization to canonical digits happens in the domain (`normalizePhone`).
    z.refine(isTeamPhone, "teamPhoneInvalid"),
  ),
  email: z.union([
    z.optional(z.string().check(z.trim(), z.email("emailInvalid"), z.maxLength(254, "emailTooLong"))),
    z.literal(""),
  ]),
  /**
   * Which job they're being given. `owner` isn't offered: there is exactly one,
   * and it moves by transfer rather than by grant — see `TransferOwnership`.
   */
  role: z.enum(GRANTABLE_ROLES),
});

/** Form value shape, and the validated payload the route forwards to the use-case. */
export type GrantAdminInput = z.infer<typeof grantAdminSchema>;

/**
 * Moving a team member to another job (`PUT /api/admin/team/:id`). The same
 * roles a grant can give: ownership moves by transfer, and taking access away is
 * a revoke, not a change to `customer`.
 */
export const changeRoleSchema = z.object({
  role: z.enum(GRANTABLE_ROLES),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

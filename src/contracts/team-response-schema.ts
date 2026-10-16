import { z } from "zod";

/**
 * The shape the team endpoints promise to return — the one place both halves of
 * the BFF bind to. `app/api/admin/team` builds its rows as `TeamMember[]`, and the
 * typed services validate the body back against it (see `parseApiResponse`), so a
 * drift on either side is a compile or parse failure rather than a silent mismatch.
 * A shared contract, hence `contracts/` and not either consumer's folder.
 *
 * A team member is a `User` narrowed to what the page shows, plus two flags the
 * API computes from context the database doesn't hold: whether this row is the
 * signed-in admin (`isSelf`), and whether their access comes from the
 * `ADMIN_USER_IDS` environment allowlist (`breakGlass`). Both exist so the UI can
 * disable a Remove button that the server would refuse anyway.
 */
export const teamMemberResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  avatarUrl: z.string().nullable(),
  /** Dashboard role — `owner` manages the team, `admin` runs the store. */
  role: z.enum(["owner", "admin"]),
  /** True when this member is the admin currently viewing the page. */
  isSelf: z.boolean(),
  /** True when access comes from the env allowlist and can't be revoked in the UI. */
  breakGlass: z.boolean(),
  /** True when this member could be made owner (i.e. isn't already, and isn't you). */
  transferable: z.boolean(),
  /**
   * Why Remove is unavailable for this row, or `null` when it is available.
   * Computed server-side, because every input to that decision is server-side:
   * who you are, what's in the env allowlist, and how many database admins
   * remain. The client re-deriving it meant two versions of one rule that
   * disagreed — a break-glass admin inflated the client's count, so it offered a
   * Remove the server then refused.
   *
   * Carrying the *reason* rather than a bare boolean lets the table explain the
   * absence instead of silently dropping the button, which left an admin with no
   * way to find out why they couldn't remove someone.
   */
  revokeBlocked: z.enum(["self", "breakGlass", "owner"]).nullable(),
});

export const teamMemberListResponseSchema = z.array(teamMemberResponseSchema);

/** One row of the dashboard's team table. */
export type TeamMember = z.infer<typeof teamMemberResponseSchema>;

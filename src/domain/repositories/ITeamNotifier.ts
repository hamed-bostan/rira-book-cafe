/** Who a team notification is going to, and how they can be reached. */
export type TeamRecipient = {
  /** Display name, for the greeting. */
  name: string;
  /** The phone they sign in with — always present, since it *is* their identity. */
  phone: string;
  /** Contact email, when one is on file; `null` skips the email channel. */
  email: string | null;
};

/**
 * Tells people when their standing on the team changes. A port (not an
 * implementation) so the domain stays channel-agnostic: the container binds a
 * notifier that fans out to email and SMS without any use-case knowing either
 * exists.
 *
 * **Best-effort** throughout: each of these fires *after* the change has
 * committed, so a delivery failure is logged by the implementation and never
 * rethrown. The notice is a courtesy; the change it reports is already real.
 */
export type ITeamNotifier = {
  /**
   * Someone was given admin access. `signInUrl` is an absolute URL to the sign-in
   * page, built by the caller (only the web layer knows the request's origin).
   */
  adminGranted(recipient: TeamRecipient, signInUrl: string): Promise<void>;

  /** This person now owns the store. */
  ownershipReceived(recipient: TeamRecipient, dashboardUrl: string): Promise<void>;

  /**
   * This person no longer owns the store, and `newOwnerName` holds it now.
   *
   * Naming the new owner is the point of sending this at all. Ownership can be
   * taken by anyone with break-glass access, so the person it was taken from
   * should learn that from a notice naming who took it — not by noticing their
   * own badge had changed.
   */
  ownershipLost(recipient: TeamRecipient, newOwnerName: string, dashboardUrl: string): Promise<void>;
};

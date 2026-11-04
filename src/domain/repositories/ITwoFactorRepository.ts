import type { NewActivityEntry } from "../entities/ActivityEntry";
import type { TwoFactorRecord, TwoFactorState } from "../entities/TwoFactor";

/** Users' authenticator-app records (see `TwoFactor.ts`). */
export type ITwoFactorRepository = {
  get(userId: string): Promise<TwoFactorRecord | null>;
  /** Each listed user's state, for the team list; users with nothing set up are `off`. */
  statesOf(userIds: readonly string[]): Promise<Record<string, TwoFactorState>>;
  /**
   * Store a new, unconfirmed secret — replacing an earlier unconfirmed one, never a
   * confirmed one (resolves false then, and nothing is written).
   */
  savePending(userId: string, sealedSecret: string): Promise<boolean>;
  /**
   * Confirm enrolment: mark it on, store the recovery codes' hashes and the step the
   * confirming code used. Only applies to a pending record holding `sealedSecret`
   * (resolves false otherwise), so a secret replaced meanwhile can't be confirmed
   * with a code from the old one. `entry` commits with it.
   */
  enable(
    userId: string,
    input: { sealedSecret: string; recoveryCodeHashes: string[]; step: number; at: Date },
    entry: NewActivityEntry,
  ): Promise<boolean>;
  /**
   * Accept a code for `step`: only if it's later than the last accepted step, in one
   * conditional write, so the same code can't be used twice even by two requests at
   * once. Resolves whether it was accepted.
   */
  useStep(userId: string, step: number): Promise<boolean>;
  /** Spend a recovery code by its hash; resolves false when it isn't one of theirs (or was used). */
  useRecoveryCode(userId: string, hash: string): Promise<boolean>;
  /** Remove the record — turned off by the user or reset by the owner. `entry` commits with it. */
  remove(userId: string, entry?: NewActivityEntry): Promise<boolean>;
};

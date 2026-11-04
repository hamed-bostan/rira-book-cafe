import {
  RECOVERY_CODE_COUNT,
  normalizeRecoveryCode,
  normalizeTotpCode,
  secondFactorGate,
  twoFactorStatus,
  type SecondFactorGate,
  type TwoFactorState,
  type TwoFactorStatus,
} from "../../entities/TwoFactor";
import { ConflictError } from "../../errors/ConflictError";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";
import { refuseSelf } from "../team/teamGuards";

import type { ActivityActor, NewActivityEntry } from "../../entities/ActivityEntry";
import type { ISessionRepository } from "../../repositories/ISessionRepository";
import type { ITeamSettingsRepository } from "../../repositories/ITeamSettingsRepository";
import type { ITwoFactorCrypto } from "../../repositories/ITwoFactorCrypto";
import type { ITwoFactorRepository } from "../../repositories/ITwoFactorRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/**
 * Authenticator-app two-factor for dashboard users (see `TwoFactor.ts`).
 *
 * Turning it on is two steps — a secret shown (QR and key), then confirmed with a
 * code from the app — so nobody locks themselves out with a secret their app never
 * took. Confirming shows ten recovery codes once; only their hashes are kept.
 *
 * Turning it on, off, and the owner resetting someone's are recorded under the
 * team's access. Codes entered at sign-in are not: they change nothing.
 */

export type TwoFactorDeps = {
  twoFactor: ITwoFactorRepository;
  crypto: ITwoFactorCrypto;
  settings: Pick<ITeamSettingsRepository, "get">;
  sessions: Pick<ISessionRepository, "markTwoFactorVerified" | "revokeAll">;
};

/** A user's two-factor, with what the screen needs around it. */
export type TwoFactorOverview = TwoFactorStatus & {
  /** The server has an encryption key, so codes can be checked and apps set up. */
  available: boolean;
  /** The owner requires it of every dashboard user. */
  required: boolean;
};

export class GetTwoFactorOverview {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto" | "settings">) {}

  async execute(userId: string): Promise<TwoFactorOverview> {
    const [record, settings] = await Promise.all([this.deps.twoFactor.get(userId), this.deps.settings.get()]);
    return {
      ...twoFactorStatus(record),
      available: this.deps.crypto.available,
      required: settings.requireTwoFactor,
    };
  }
}

/** Each team member's two-factor state, for the team list. */
export class GetTwoFactorStates {
  constructor(private readonly twoFactor: Pick<ITwoFactorRepository, "statesOf">) {}

  execute(userIds: readonly string[]): Promise<Record<string, TwoFactorState>> {
    return userIds.length === 0 ? Promise.resolve({}) : this.twoFactor.statesOf(userIds);
  }
}

/**
 * Where this browser's session stands with the second factor — what the dashboard's
 * door asks on every request (see `require-permission`).
 */
export class GetSecondFactorGate {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto" | "settings">) {}

  async execute(userId: string, verifiedInThisSession: boolean): Promise<SecondFactorGate> {
    // Already through here: no reads at all, the common case on every request.
    if (verifiedInThisSession) return "ok";
    const [record, settings] = await Promise.all([this.deps.twoFactor.get(userId), this.deps.settings.get()]);
    return secondFactorGate({
      state: twoFactorStatus(record).state,
      requiredByOwner: settings.requireTwoFactor,
      available: this.deps.crypto.available,
      verifiedInThisSession,
    });
  }
}

/** What enrolment shows: the QR code and the same secret as a key to type. */
export type TwoFactorSetup = {
  secret: string;
  otpauthUri: string;
  qrCode: string;
};

export class StartTwoFactorSetup {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto">) {}

  /** `accountName` is how the app lists the account — the user's phone, say. */
  async execute(userId: string, accountName: string): Promise<TwoFactorSetup> {
    if (!this.deps.crypto.available) {
      throw new ConflictError("TWO_FACTOR_UNAVAILABLE", "Two-factor isn't set up on this server.");
    }
    const secret = this.deps.crypto.newSecret();
    const saved = await this.deps.twoFactor.savePending(userId, this.deps.crypto.seal(secret));
    if (!saved) throw new ConflictError("TWO_FACTOR_ALREADY_ON", "Two-factor is already on.");
    const otpauthUri = this.deps.crypto.otpauthUri(secret, accountName);
    return { secret, otpauthUri, qrCode: await this.deps.crypto.qrCode(otpauthUri) };
  }
}

export class ConfirmTwoFactorSetup {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto" | "sessions">) {}

  /**
   * Check the first code against the pending secret and turn two-factor on. The
   * browser doing it counts as verified — it just proved it has the app. Resolves
   * the recovery codes, in the clear, for this one response only.
   */
  async execute(
    userId: string,
    sessionId: string,
    input: string,
    actor: ActivityActor,
    now: Date = new Date(),
  ): Promise<string[]> {
    const { crypto, twoFactor } = this.deps;
    if (!crypto.available) throw new ConflictError("TWO_FACTOR_UNAVAILABLE", "Two-factor isn't set up on this server.");

    const record = await twoFactor.get(userId);
    if (!record) throw new NotFoundError("two-factor setup", userId);
    if (record.enabledAt) throw new ConflictError("TWO_FACTOR_ALREADY_ON", "Two-factor is already on.");

    const code = normalizeTotpCode(input);
    const step = code ? crypto.matchCode(crypto.open(record.sealedSecret), code, now) : null;
    if (step === null) throw wrongCode();

    const codes = crypto.newRecoveryCodes(RECOVERY_CODE_COUNT);
    const hashes = codes.map((shown) => crypto.hashRecoveryCode(normalizeRecoveryCode(shown) ?? shown));
    const enabled = await twoFactor.enable(
      userId,
      { sealedSecret: record.sealedSecret, recoveryCodeHashes: hashes, step, at: now },
      twoFactorEntry(actor, actor, "user.twoFactorEnabled", "off", "on"),
    );
    // Lost a race with another tab that restarted or finished enrolment.
    if (!enabled) throw new ConflictError("TWO_FACTOR_ALREADY_ON", "Two-factor changed meanwhile. Please start again.");

    await this.deps.sessions.markTwoFactorVerified(sessionId, now);
    return codes;
  }
}

/** A code from the app, or one of the recovery codes. */
export type SecondFactorInput = { code: string } | { recoveryCode: string };

export class VerifySecondFactor {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto" | "sessions">) {}

  /** Check the code and mark this browser's session verified. A wrong code is a `ValidationError`. */
  async execute(userId: string, sessionId: string, input: SecondFactorInput, now: Date = new Date()): Promise<void> {
    await checkSecondFactor(this.deps, userId, input, now);
    await this.deps.sessions.markTwoFactorVerified(sessionId, now);
  }
}

export class DisableTwoFactor {
  constructor(private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "crypto" | "settings">) {}

  /**
   * Turn your own two-factor off, proving it with a current code (or a recovery
   * code). Refused while the owner requires it: they'd only be sent straight back
   * to set it up again.
   */
  async execute(userId: string, input: SecondFactorInput, actor: ActivityActor, now: Date = new Date()): Promise<void> {
    const settings = await this.deps.settings.get();
    if (settings.requireTwoFactor && this.deps.crypto.available) {
      throw new ConflictError("TWO_FACTOR_REQUIRED", "The owner requires two-factor for the dashboard.");
    }
    await checkSecondFactor(this.deps, userId, input, now);
    await this.deps.twoFactor.remove(userId, twoFactorEntry(actor, actor, "user.twoFactorDisabled", "on", "off"));
  }
}

export class ResetTwoFactor {
  constructor(
    private readonly deps: Pick<TwoFactorDeps, "twoFactor" | "sessions"> & { users: Pick<IUserRepository, "getById"> },
  ) {}

  /**
   * The owner clears a member's authenticator app — a lost phone, say — and signs
   * them out everywhere, so whoever has the old phone gets nothing from it. They set
   * the app up again next time (straight away, if the owner requires it). Your own
   * is turned off from your own security page, with a code.
   */
  async execute(targetId: string, actor: ActivityActor): Promise<void> {
    refuseSelf(targetId, actor.id, "Turn off your own two-factor from your security page.");
    const [user, record] = await Promise.all([this.deps.users.getById(targetId), this.deps.twoFactor.get(targetId)]);
    if (!user) throw new NotFoundError("user", targetId);
    if (!record) throw new NotFoundError("two-factor setup", targetId);

    await this.deps.twoFactor.remove(
      targetId,
      twoFactorEntry(
        actor,
        { id: user.id, name: user.name },
        "user.twoFactorReset",
        record.enabledAt ? "on" : "pending",
        "off",
      ),
    );
    await this.deps.sessions.revokeAll(targetId);
  }
}

/** Check a code or a recovery code; throws a `ValidationError` on `code` when it doesn't work. */
async function checkSecondFactor(
  deps: Pick<TwoFactorDeps, "twoFactor" | "crypto">,
  userId: string,
  input: SecondFactorInput,
  now: Date,
): Promise<void> {
  const record = await deps.twoFactor.get(userId);
  if (!record?.enabledAt) throw new NotFoundError("two-factor setup", userId);

  if ("recoveryCode" in input) {
    const normalized = normalizeRecoveryCode(input.recoveryCode);
    const used = normalized
      ? await deps.twoFactor.useRecoveryCode(userId, deps.crypto.hashRecoveryCode(normalized))
      : false;
    if (!used) throw wrongCode("recoveryCode");
    return;
  }

  if (!deps.crypto.available) {
    throw new ConflictError(
      "TWO_FACTOR_UNAVAILABLE",
      "Codes can't be checked on this server right now. Use a recovery code.",
    );
  }
  const code = normalizeTotpCode(input.code);
  const step = code ? deps.crypto.matchCode(deps.crypto.open(record.sealedSecret), code, now) : null;
  // A code already used (this one, or a later one) is as good as a wrong one.
  if (step === null || !(await deps.twoFactor.useStep(userId, step))) throw wrongCode();
}

function wrongCode(field: "code" | "recoveryCode" = "code"): ValidationError {
  return new ValidationError(field, "twoFactorCodeInvalid");
}

function twoFactorEntry(
  actor: ActivityActor,
  user: { id: string; name: string },
  action: "user.twoFactorEnabled" | "user.twoFactorDisabled" | "user.twoFactorReset",
  before: string,
  after: string,
): NewActivityEntry {
  return {
    actorId: actor.id,
    actorName: actor.name,
    action,
    entityType: "user",
    entityId: user.id,
    entityLabel: user.name,
    changes: [{ field: "twoFactor", before, after }],
  };
}

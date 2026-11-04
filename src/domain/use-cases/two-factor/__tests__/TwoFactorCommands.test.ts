import { describe, expect, it, vi } from "vitest";

import { ConflictError } from "../../../errors/ConflictError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  ConfirmTwoFactorSetup,
  DisableTwoFactor,
  GetSecondFactorGate,
  ResetTwoFactor,
  StartTwoFactorSetup,
  VerifySecondFactor,
} from "../TwoFactorCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { TeamSettings } from "../../../entities/TeamSettings";
import type { TwoFactorRecord } from "../../../entities/TwoFactor";
import type { ITwoFactorCrypto } from "../../../repositories/ITwoFactorCrypto";
import type { ITwoFactorRepository } from "../../../repositories/ITwoFactorRepository";

const ME = { id: "u1", name: "Sara" };
const NOW = new Date("2026-11-04T10:00:00Z");

/** A fake crypto: "sealing" prefixes, and the only good code is "123456" (step 42). */
function fakeCrypto(available = true): ITwoFactorCrypto {
  return {
    available,
    newSecret: () => "SECRET",
    seal: (secret) => `sealed:${secret}`,
    open: (sealed) => sealed.replace("sealed:", ""),
    otpauthUri: (secret, account) => `otpauth://totp/${account}?secret=${secret}`,
    qrCode: async () => "data:image/png;base64,AAA",
    matchCode: (_secret, code) => (code === "123456" ? 42 : null),
    newRecoveryCodes: (count) =>
      Array.from({ length: count }, (_, index) => `AAAA-BBBB-CCCC-DDD${"ABCDEFGHIJ"[index]}`),
    hashRecoveryCode: (normalized) => `hash:${normalized}`,
  };
}

/** An in-memory two-factor table. */
function store(initial: TwoFactorRecord | null = null) {
  let record = initial;
  const entries: NewActivityEntry[] = [];
  const repo: ITwoFactorRepository = {
    get: async () => record,
    statesOf: async () => ({}),
    savePending: async (userId, sealedSecret) => {
      if (record?.enabledAt) return false;
      record = { userId, sealedSecret, enabledAt: null, lastUsedStep: null, recoveryCodeHashes: [] };
      return true;
    },
    enable: async (_userId, input, entry) => {
      if (!record || record.enabledAt || record.sealedSecret !== input.sealedSecret) return false;
      record = {
        ...record,
        enabledAt: input.at,
        lastUsedStep: input.step,
        recoveryCodeHashes: input.recoveryCodeHashes,
      };
      entries.push(entry);
      return true;
    },
    useStep: async (_userId, step) => {
      if (!record?.enabledAt || (record.lastUsedStep !== null && record.lastUsedStep >= step)) return false;
      record = { ...record, lastUsedStep: step };
      return true;
    },
    useRecoveryCode: async (_userId, hash) => {
      if (!record?.recoveryCodeHashes.includes(hash)) return false;
      record = { ...record, recoveryCodeHashes: record.recoveryCodeHashes.filter((h) => h !== hash) };
      return true;
    },
    remove: async (_userId, entry) => {
      if (!record) return false;
      record = null;
      if (entry) entries.push(entry);
      return true;
    },
  };
  return { repo, entries, current: () => record };
}

const sessions = () => ({ markTwoFactorVerified: vi.fn(async () => {}), revokeAll: vi.fn(async () => 2) });
const settings = (requireTwoFactor = false) => ({
  get: async (): Promise<TeamSettings> => ({ requireTwoFactor, activityRetentionMonths: null }),
});

const ENABLED: TwoFactorRecord = {
  userId: "u1",
  sealedSecret: "sealed:SECRET",
  enabledAt: new Date("2026-10-01T00:00:00Z"),
  lastUsedStep: 10,
  recoveryCodeHashes: ["hash:AAAABBBBCCCCDDDA"],
};

describe("setting up an authenticator app", () => {
  it("shows a secret, then turns on with the app's code, verifying this browser and recording it", async () => {
    const two = store();
    const crypto = fakeCrypto();
    const setup = await new StartTwoFactorSetup({ twoFactor: two.repo, crypto }).execute("u1", "0912");
    expect(setup).toMatchObject({ secret: "SECRET", otpauthUri: "otpauth://totp/0912?secret=SECRET" });
    expect(two.current()?.enabledAt).toBeNull();

    const browser = sessions();
    const codes = await new ConfirmTwoFactorSetup({ twoFactor: two.repo, crypto, sessions: browser }).execute(
      "u1",
      "s1",
      "123 456",
      ME,
      NOW,
    );
    expect(codes).toHaveLength(10);
    expect(two.current()).toMatchObject({ enabledAt: NOW, lastUsedStep: 42 });
    // Only hashes are kept.
    expect(two.current()?.recoveryCodeHashes.every((hash) => hash.startsWith("hash:"))).toBe(true);
    expect(browser.markTwoFactorVerified).toHaveBeenCalledWith("s1", NOW);
    expect(two.entries[0]).toMatchObject({ action: "user.twoFactorEnabled", entityId: "u1" });
  });

  it("refuses a wrong first code and leaves it off", async () => {
    const two = store({ ...ENABLED, enabledAt: null, recoveryCodeHashes: [] });
    await expect(
      new ConfirmTwoFactorSetup({ twoFactor: two.repo, crypto: fakeCrypto(), sessions: sessions() }).execute(
        "u1",
        "s1",
        "000000",
        ME,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(two.current()?.enabledAt).toBeNull();
  });

  it("won't replace an app that's already on, and isn't offered without a key", async () => {
    await expect(
      new StartTwoFactorSetup({ twoFactor: store(ENABLED).repo, crypto: fakeCrypto() }).execute("u1", "x"),
    ).rejects.toMatchObject({ code: "TWO_FACTOR_ALREADY_ON" });
    await expect(
      new StartTwoFactorSetup({ twoFactor: store().repo, crypto: fakeCrypto(false) }).execute("u1", "x"),
    ).rejects.toMatchObject({ code: "TWO_FACTOR_UNAVAILABLE" });
  });
});

describe("VerifySecondFactor", () => {
  it("accepts the app's code once — the same code twice is refused", async () => {
    const two = store(ENABLED);
    const browser = sessions();
    const verify = new VerifySecondFactor({ twoFactor: two.repo, crypto: fakeCrypto(), sessions: browser });
    await verify.execute("u1", "s1", { code: "123456" }, NOW);
    expect(browser.markTwoFactorVerified).toHaveBeenCalledWith("s1", NOW);
    await expect(verify.execute("u1", "s2", { code: "123456" }, NOW)).rejects.toBeInstanceOf(ValidationError);
  });

  it("accepts each recovery code once, even without a key", async () => {
    const two = store(ENABLED);
    const verify = new VerifySecondFactor({ twoFactor: two.repo, crypto: fakeCrypto(false), sessions: sessions() });
    await verify.execute("u1", "s1", { recoveryCode: "aaaa-bbbb-cccc-ddda" });
    expect(two.current()?.recoveryCodeHashes).toEqual([]);
    await expect(verify.execute("u1", "s1", { recoveryCode: "AAAA-BBBB-CCCC-DDDA" })).rejects.toMatchObject({
      field: "recoveryCode",
    });
  });

  it("can't check app codes without the key", async () => {
    await expect(
      new VerifySecondFactor({
        twoFactor: store(ENABLED).repo,
        crypto: fakeCrypto(false),
        sessions: sessions(),
      }).execute("u1", "s1", { code: "123456" }),
    ).rejects.toMatchObject({ code: "TWO_FACTOR_UNAVAILABLE" });
  });
});

describe("DisableTwoFactor", () => {
  it("turns it off with a current code, and records it", async () => {
    const two = store(ENABLED);
    await new DisableTwoFactor({ twoFactor: two.repo, crypto: fakeCrypto(), settings: settings() }).execute(
      "u1",
      { code: "123456" },
      ME,
      NOW,
    );
    expect(two.current()).toBeNull();
    expect(two.entries[0]).toMatchObject({ action: "user.twoFactorDisabled" });
  });

  it("is refused while the owner requires it", async () => {
    const two = store(ENABLED);
    await expect(
      new DisableTwoFactor({ twoFactor: two.repo, crypto: fakeCrypto(), settings: settings(true) }).execute(
        "u1",
        { code: "123456" },
        ME,
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(two.current()).not.toBeNull();
  });
});

describe("ResetTwoFactor", () => {
  const users = {
    getById: async (id: string) => ({
      id,
      phone: id,
      name: "Kian",
      email: null,
      avatarUrl: null,
      role: "staff" as const,
    }),
  };

  it("clears a member's app, signs them out everywhere, and records it under their name", async () => {
    const two = store({ ...ENABLED, userId: "m1" });
    const browser = sessions();
    await new ResetTwoFactor({ twoFactor: two.repo, sessions: browser, users }).execute("m1", {
      id: "owner",
      name: "Rira",
    });
    expect(two.current()).toBeNull();
    expect(browser.revokeAll).toHaveBeenCalledWith("m1");
    expect(two.entries[0]).toMatchObject({ action: "user.twoFactorReset", entityId: "m1", entityLabel: "Kian" });
  });

  it("refuses your own — that's turned off with a code", async () => {
    await expect(
      new ResetTwoFactor({ twoFactor: store(ENABLED).repo, sessions: sessions(), users }).execute("owner", {
        id: "owner",
        name: "Rira",
      }),
    ).rejects.toMatchObject({ reason: "self" });
  });
});

describe("GetSecondFactorGate", () => {
  it("asks an enrolled user once per browser, and sends others to enrol when the owner requires it", async () => {
    const deps = (record: TwoFactorRecord | null, required = false) => ({
      twoFactor: store(record).repo,
      crypto: fakeCrypto(),
      settings: settings(required),
    });
    expect(await new GetSecondFactorGate(deps(ENABLED)).execute("u1", false)).toBe("verify");
    expect(await new GetSecondFactorGate(deps(ENABLED)).execute("u1", true)).toBe("ok");
    expect(await new GetSecondFactorGate(deps(null, true)).execute("u1", false)).toBe("enroll");
    expect(await new GetSecondFactorGate(deps(null)).execute("u1", false)).toBe("ok");
  });
});

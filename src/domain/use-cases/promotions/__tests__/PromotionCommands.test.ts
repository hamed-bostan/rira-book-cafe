import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettings, type LoyaltyTransaction } from "../../../entities/Loyalty";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  AdjustGuestPoints,
  CreatePromoCode,
  GetLoyaltySettings,
  GetOwnLoyaltyAccount,
  ListPromoCodes,
  LOYALTY_HISTORY_LIMIT,
  LookupGuestPoints,
  SetPromoCodeActive,
  UpdateLoyaltySettings,
  UpdatePromoCode,
} from "../PromotionCommands";

import type { NewActivityEntry } from "../../../entities/ActivityEntry";
import type { PromoCode } from "../../../entities/Promotion";
import type { User } from "../../../entities/User";
import type { AuditHook } from "../../../repositories/AuditHook";
import type { ILoyaltyRepository, PointsAdjustment } from "../../../repositories/ILoyaltyRepository";
import type { IPromotionRepository, PromoCodeInput } from "../../../repositories/IPromotionRepository";

const STAFF = { id: "s1", name: "Staff" };

const INPUT: PromoCodeInput = {
  code: "  welcome10 ",
  description: "  New guests  ",
  kind: "percent",
  value: 10,
  maxDiscount: 50_000,
  minSubtotal: 0,
  isActive: true,
};

function promo(overrides: Partial<PromoCode> = {}): PromoCode {
  return {
    id: "p1",
    code: "WELCOME10",
    description: "New guests",
    kind: "percent",
    value: 10,
    maxDiscount: 50_000,
    minSubtotal: 0,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type PromoFake = {
  repo: IPromotionRepository;
  create: ReturnType<typeof vi.fn<IPromotionRepository["create"]>>;
  update: ReturnType<typeof vi.fn<IPromotionRepository["update"]>>;
  entries: (NewActivityEntry | null)[];
};

/** A promo table holding `current`, whose writes run the audit hook the way the real one does. */
function promoRepo(current: PromoCode | null): PromoFake {
  const entries: (NewActivityEntry | null)[] = [];
  const persist = (id: string, input: PromoCodeInput, audit?: AuditHook<PromoCode>): PromoCode => {
    const saved: PromoCode = { ...promo({ id }), ...input, id };
    if (audit) entries.push(audit(saved));
    return saved;
  };
  const create = vi.fn<IPromotionRepository["create"]>(async (input, audit) => persist("new", input, audit));
  const update = vi.fn<IPromotionRepository["update"]>(async (id, input, audit) => persist(id, input, audit));
  const repo: IPromotionRepository = {
    list: vi.fn(async () => [{ ...promo(), uses: 3 }]),
    getById: vi.fn(async (id: string) => (current?.id === id ? current : null)),
    getByCode: vi.fn(async () => null),
    usage: vi.fn(async () => ({ total: 0, byGuest: 0 })),
    create,
    update,
  };
  return { repo, create, update, entries };
}

describe("CreatePromoCode", () => {
  it("normalizes the code, trims the description and audits every field", async () => {
    const { repo, create, entries } = promoRepo(null);
    const saved = await new CreatePromoCode(repo).execute(INPUT, STAFF);

    expect(create.mock.calls[0][0]).toMatchObject({ code: "WELCOME10", description: "New guests" });
    expect(saved.code).toBe("WELCOME10");
    expect(entries[0]).toMatchObject({
      actorId: "s1",
      actorName: "Staff",
      action: "promoCode.created",
      entityType: "promoCode",
      entityId: "new",
      entityLabel: "WELCOME10",
    });
    // A creation lists every field, with nothing on the "before" side.
    expect(entries[0]?.changes).toHaveLength(11);
    expect(entries[0]?.changes.every((change) => change.before === null)).toBe(true);
    expect(entries[0]?.changes.find((change) => change.field === "value")?.after).toBe("10");
  });

  it("drops a blank description rather than storing an empty one", async () => {
    const { repo, create } = promoRepo(null);
    await new CreatePromoCode(repo).execute({ ...INPUT, description: "   " }, STAFF);
    expect(create.mock.calls[0][0].description).toBeUndefined();
  });

  it.each<[string, Partial<PromoCodeInput>, string]>([
    ["a code with spaces", { code: "TWO WORDS" }, "code"],
    ["a code that's too short", { code: "ab" }, "code"],
    ["a zero value", { value: 0 }, "value"],
    ["a fractional value", { value: 2.5 }, "value"],
    ["a percentage over 100", { value: 101 }, "value"],
    ["a description over the limit", { description: "x".repeat(121) }, "description"],
    ["an end before the start", { startsAt: "2026-02-01T00:00:00.000Z", endsAt: "2026-01-01T00:00:00.000Z" }, "endsAt"],
    ["an end equal to the start", { startsAt: "2026-02-01T00:00:00.000Z", endsAt: "2026-02-01T00:00:00.000Z" }, "endsAt"],
  ])("refuses %s before writing", async (_label, overrides, field) => {
    const { repo, create } = promoRepo(null);
    await expect(async () => new CreatePromoCode(repo).execute({ ...INPUT, ...overrides }, STAFF)).rejects.toMatchObject({
      name: "ValidationError",
      field,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("allows a fixed amount over 100", async () => {
    const { repo } = promoRepo(null);
    const saved = await new CreatePromoCode(repo).execute({ ...INPUT, kind: "fixed", value: 20_000 }, STAFF);
    expect(saved.value).toBe(20_000);
  });
});

describe("UpdatePromoCode", () => {
  it("is not found for an unknown id", async () => {
    const { repo, update } = promoRepo(null);
    await expect(new UpdatePromoCode(repo).execute("missing", INPUT, STAFF)).rejects.toThrow(NotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it("records only the fields that moved", async () => {
    const { repo, entries } = promoRepo(promo());
    await new UpdatePromoCode(repo).execute("p1", { ...INPUT, value: 15, minSubtotal: 100_000 }, STAFF);
    expect(entries[0]).toMatchObject({ action: "promoCode.updated", entityId: "p1", entityLabel: "WELCOME10" });
    expect(entries[0]?.changes).toEqual([
      { field: "value", before: "10", after: "15" },
      { field: "minSubtotal", before: "0", after: "100000" },
    ]);
  });

  it("records nothing for a save that changed nothing", async () => {
    const { repo, entries } = promoRepo(promo());
    await new UpdatePromoCode(repo).execute("p1", INPUT, STAFF);
    expect(entries).toEqual([null]);
  });

  it("names a save that only flipped isActive as an active change", async () => {
    const { repo, entries } = promoRepo(promo());
    await new UpdatePromoCode(repo).execute("p1", { ...INPUT, isActive: false }, STAFF);
    expect(entries[0]).toMatchObject({
      action: "promoCode.activeChanged",
      changes: [{ field: "isActive", before: "true", after: "false" }],
    });
  });

  it("validates the input like a create does", async () => {
    const { repo } = promoRepo(promo());
    await expect(new UpdatePromoCode(repo).execute("p1", { ...INPUT, value: -1 }, STAFF)).rejects.toThrow(ValidationError);
  });
});

describe("SetPromoCodeActive", () => {
  it("is not found for an unknown id", async () => {
    const { repo } = promoRepo(null);
    await expect(new SetPromoCodeActive(repo).execute("missing", false, STAFF)).rejects.toThrow(NotFoundError);
  });

  it("returns the code untouched when it already has that state", async () => {
    const current = promo({ isActive: true });
    const { repo, update } = promoRepo(current);
    expect(await new SetPromoCodeActive(repo).execute("p1", true, STAFF)).toBe(current);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps every other field and logs the switch", async () => {
    const { repo, update, entries } = promoRepo(promo({ isActive: true }));
    const saved = await new SetPromoCodeActive(repo).execute("p1", false, STAFF);
    expect(saved.isActive).toBe(false);
    const sent = update.mock.calls[0][1];
    expect(sent).not.toHaveProperty("id");
    expect(sent).not.toHaveProperty("createdAt");
    expect(sent).toMatchObject({ code: "WELCOME10", value: 10, maxDiscount: 50_000, isActive: false });
    expect(entries[0]?.action).toBe("promoCode.activeChanged");
  });
});

describe("ListPromoCodes", () => {
  it("reads the list from the repository", async () => {
    const { repo } = promoRepo(null);
    expect(await new ListPromoCodes(repo).execute()).toEqual([{ ...promo(), uses: 3 }]);
  });
});

function transaction(overrides: Partial<LoyaltyTransaction> = {}): LoyaltyTransaction {
  return { id: "t1", userId: "09120000000", delta: 10, reason: "earn", createdAt: "", ...overrides };
}

type LoyaltyFake = {
  repo: ILoyaltyRepository;
  saveSettings: ReturnType<typeof vi.fn<ILoyaltyRepository["saveSettings"]>>;
  history: ReturnType<typeof vi.fn<ILoyaltyRepository["history"]>>;
  adjust: ReturnType<typeof vi.fn<ILoyaltyRepository["adjust"]>>;
};

function loyaltyRepo(): LoyaltyFake {
  const saveSettings = vi.fn<ILoyaltyRepository["saveSettings"]>(async (settings) => settings);
  const history = vi.fn<ILoyaltyRepository["history"]>(async (userId) => [transaction({ userId })]);
  const adjust = vi.fn<ILoyaltyRepository["adjust"]>(async (adjustment: PointsAdjustment) =>
    transaction({ userId: adjustment.userId, delta: adjustment.delta, reason: "adjust", note: adjustment.note }),
  );
  const repo: ILoyaltyRepository = {
    getSettings: vi.fn(async () => DEFAULT_LOYALTY_SETTINGS),
    saveSettings,
    balance: vi.fn(async () => 120),
    history,
    adjust,
  };
  return { repo, saveSettings, history, adjust };
}

const GUEST: User = { id: "09120000000", phone: "+989120000000", name: "Sara", email: null, avatarUrl: null, role: "customer" };

function users(...known: User[]): { getById: (id: string) => Promise<User | null> } {
  return { getById: async (id: string): Promise<User | null> => known.find((u) => u.id === id) ?? null };
}

describe("loyalty settings", () => {
  it("reads the settings from the repository", async () => {
    expect(await new GetLoyaltySettings(loyaltyRepo().repo).execute()).toEqual(DEFAULT_LOYALTY_SETTINGS);
  });

  it("saves well-formed settings", async () => {
    const { repo, saveSettings } = loyaltyRepo();
    const next: LoyaltySettings = { enabled: false, tomanPerPoint: 5_000, pointValue: 500, minRedeemPoints: 0 };
    expect(await new UpdateLoyaltySettings(repo).execute(next)).toEqual(next);
    expect(saveSettings).toHaveBeenCalledWith(next);
  });

  it.each<[Partial<LoyaltySettings>, string]>([
    [{ tomanPerPoint: 0 }, "tomanPerPoint"],
    [{ tomanPerPoint: 1.5 }, "tomanPerPoint"],
    [{ pointValue: -1 }, "pointValue"],
    [{ minRedeemPoints: -1 }, "minRedeemPoints"],
    [{ minRedeemPoints: 0.5 }, "minRedeemPoints"],
  ])("refuses %o", async (overrides, field) => {
    const { repo, saveSettings } = loyaltyRepo();
    await expect(async () => new UpdateLoyaltySettings(repo).execute({ ...DEFAULT_LOYALTY_SETTINGS, ...overrides })).rejects.toMatchObject({
      field,
    });
    expect(saveSettings).not.toHaveBeenCalled();
  });
});

describe("GetOwnLoyaltyAccount / LookupGuestPoints", () => {
  it("returns the balance with a capped history", async () => {
    const { repo, history } = loyaltyRepo();
    const account = await new GetOwnLoyaltyAccount(repo).execute("09120000000");
    expect(account.balance).toBe(120);
    expect(account.history).toHaveLength(1);
    expect(history).toHaveBeenCalledWith("09120000000", LOYALTY_HISTORY_LIMIT);
  });

  it("looks a guest up by their normalized phone", async () => {
    const lookup = await new LookupGuestPoints(loyaltyRepo().repo, users(GUEST)).execute("+98 912 000 0000");
    expect(lookup).toMatchObject({ userId: "09120000000", name: "Sara", balance: 120 });
  });

  it("refuses an implausible phone", async () => {
    await expect(new LookupGuestPoints(loyaltyRepo().repo, users(GUEST)).execute("123")).rejects.toThrow(ValidationError);
  });

  it("is not found for a phone with no account", async () => {
    await expect(new LookupGuestPoints(loyaltyRepo().repo, users()).execute("09120000000")).rejects.toThrow(NotFoundError);
  });
});

describe("AdjustGuestPoints", () => {
  it("hands the repository a trimmed note attributed to the staff member", async () => {
    const { repo, adjust } = loyaltyRepo();
    await new AdjustGuestPoints(repo, users(GUEST)).execute({ phone: "+989120000000", delta: -20, note: "  goodwill  " }, STAFF);
    expect(adjust).toHaveBeenCalledWith({ userId: "09120000000", delta: -20, note: "goodwill", by: STAFF });
  });

  it.each<[string, { phone: string; delta: number; note: string }, string]>([
    ["a bad phone", { phone: "12", delta: 5, note: "x" }, "phone"],
    ["a zero delta", { phone: "09120000000", delta: 0, note: "x" }, "delta"],
    ["a fractional delta", { phone: "09120000000", delta: 1.5, note: "x" }, "delta"],
    ["a delta over the cap", { phone: "09120000000", delta: 100_001, note: "x" }, "delta"],
    ["a blank note", { phone: "09120000000", delta: 5, note: "   " }, "note"],
    ["a note over the limit", { phone: "09120000000", delta: 5, note: "x".repeat(201) }, "note"],
  ])("refuses %s", async (_label, input, field) => {
    const { repo, adjust } = loyaltyRepo();
    await expect(new AdjustGuestPoints(repo, users(GUEST)).execute(input, STAFF)).rejects.toMatchObject({ field });
    expect(adjust).not.toHaveBeenCalled();
  });

  it("is not found for a phone with no account", async () => {
    const { repo, adjust } = loyaltyRepo();
    await expect(
      new AdjustGuestPoints(repo, users()).execute({ phone: "09120000000", delta: 5, note: "x" }, STAFF),
    ).rejects.toThrow(NotFoundError);
    expect(adjust).not.toHaveBeenCalled();
  });
});

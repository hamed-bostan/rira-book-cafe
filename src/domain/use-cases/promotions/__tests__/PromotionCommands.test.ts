import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOYALTY_SETTINGS, type LoyaltySettings, type LoyaltyTransaction } from "../../../entities/Loyalty";
import { MAX_ORDER_AMOUNT } from "../../../entities/Order";
import { NotFoundError } from "../../../errors/NotFoundError";
import { ResourceInUseError } from "../../../errors/ResourceInUseError";
import { ValidationError } from "../../../errors/ValidationError";
import {
  AdjustGuestPoints,
  CreatePromoCode,
  DeletePromoCode,
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
const NOW = new Date("2026-11-04T09:00:00.000Z");

const INPUT: PromoCodeInput = {
  code: "  welcome10 ",
  description: "  New guests  ",
  kind: "percent",
  value: 10,
  maxDiscount: 50_000,
  minSubtotal: 0,
  isActive: true,
  productIds: [],
  categoryIds: [],
  firstOrderOnly: false,
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
    productIds: [],
    categoryIds: [],
    firstOrderOnly: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

type PromoFake = {
  repo: IPromotionRepository;
  create: ReturnType<typeof vi.fn<IPromotionRepository["create"]>>;
  update: ReturnType<typeof vi.fn<IPromotionRepository["update"]>>;
  remove: ReturnType<typeof vi.fn<IPromotionRepository["delete"]>>;
  archive: ReturnType<typeof vi.fn<IPromotionRepository["archive"]>>;
  entries: (NewActivityEntry | null)[];
};

type PromoTable = {
  /** Orders carried the code before the delete was asked for. */
  used?: boolean;
  /** An order took the code after the check, so the delete itself refuses. */
  usedMeanwhile?: boolean;
  /** Codes held by archived (deleted, used) codes. */
  archivedCodes?: readonly string[];
};

/** A promo table holding `current`, whose writes run the audit hook the way the real one does. */
function promoRepo(current: PromoCode | null, table: PromoTable = {}): PromoFake {
  const entries: (NewActivityEntry | null)[] = [];
  const persist = (id: string, input: PromoCodeInput, audit?: AuditHook<PromoCode>): PromoCode => {
    const saved: PromoCode = { ...promo({ id }), ...input, id };
    if (audit) entries.push(audit(saved));
    return saved;
  };
  const create = vi.fn<IPromotionRepository["create"]>(async (input, audit) => persist("new", input, audit));
  const update = vi.fn<IPromotionRepository["update"]>(async (id, input, audit) => persist(id, input, audit));
  const remove = vi.fn<IPromotionRepository["delete"]>(async (_id, audit) => {
    if (table.usedMeanwhile) throw new ResourceInUseError("promo code", "Orders have used this code.");
    if (audit) entries.push(audit());
  });
  const archive = vi.fn<IPromotionRepository["archive"]>(async (id, at, audit) => {
    const saved: PromoCode = { ...(current as PromoCode), id, isActive: false, archivedAt: at.toISOString() };
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const repo: IPromotionRepository = {
    list: vi.fn(async () => [{ ...promo(), uses: 3 }]),
    getById: vi.fn(async (id: string) => (current?.id === id ? current : null)),
    getByCode: vi.fn(async () => null),
    getArchivedByCode: vi.fn(async (code: string) =>
      table.archivedCodes?.includes(code) ? promo({ id: "old", code, archivedAt: "2026-01-02T00:00:00.000Z" }) : null,
    ),
    usage: vi.fn(async () => ({ total: 0, byGuest: 0 })),
    hasCompletedOrder: vi.fn(async () => false),
    isUsed: vi.fn(async () => table.used ?? false),
    create,
    update,
    delete: remove,
    archive,
  };
  return { repo, create, update, remove, archive, entries };
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
    expect(entries[0]?.changes).toHaveLength(14);
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
    ["a code with a dash", { code: "AUTUMN-15" }, "code"],
    ["a code with an underscore", { code: "AUTUMN_15" }, "code"],
    ["a code that's too short", { code: "ab" }, "code"],
    ["a code that's too long", { code: "X".repeat(17) }, "code"],
    ["a zero value", { value: 0 }, "value"],
    ["a fractional value", { value: 2.5 }, "value"],
    ["a percentage over 100", { value: 101 }, "value"],
    ["a fixed amount past an order's", { kind: "fixed", value: MAX_ORDER_AMOUNT + 1 }, "value"],
    ["a cap past an order's", { maxDiscount: MAX_ORDER_AMOUNT + 1 }, "maxDiscount"],
    ["a minimum past an order's", { minSubtotal: MAX_ORDER_AMOUNT + 1 }, "minSubtotal"],
    ["a description over the limit", { description: "x".repeat(121) }, "description"],
    ["an end before the start", { startsAt: "2026-02-01T00:00:00.000Z", endsAt: "2026-01-01T00:00:00.000Z" }, "endsAt"],
    [
      "an end equal to the start",
      { startsAt: "2026-02-01T00:00:00.000Z", endsAt: "2026-02-01T00:00:00.000Z" },
      "endsAt",
    ],
  ])("refuses %s before writing", async (_label, overrides, field) => {
    const { repo, create } = promoRepo(null);
    await expect(async () =>
      new CreatePromoCode(repo).execute({ ...INPUT, ...overrides }, STAFF),
    ).rejects.toMatchObject({
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

  it("refuses the code of a deleted code orders used, so its per-guest limits can't start over", async () => {
    const { repo, create } = promoRepo(null, { archivedCodes: ["WELCOME10"] });
    await expect(new CreatePromoCode(repo).execute(INPUT, STAFF)).rejects.toMatchObject({
      name: "ValidationError",
      field: "code",
      message: "codeArchived",
    });
    expect(create).not.toHaveBeenCalled();
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
    await expect(new UpdatePromoCode(repo).execute("p1", { ...INPUT, value: -1 }, STAFF)).rejects.toThrow(
      ValidationError,
    );
  });

  it("keeps a code saved with a dash before the rule while it's unchanged, but won't take a new one", async () => {
    const { repo, update } = promoRepo(promo({ code: "AUTUMN-15" }));
    await new UpdatePromoCode(repo).execute("p1", { ...INPUT, code: "autumn-15", value: 15 }, STAFF);
    expect(update.mock.calls[0][1].code).toBe("AUTUMN-15");
    await expect(new UpdatePromoCode(repo).execute("p1", { ...INPUT, code: "AUTUMN-16" }, STAFF)).rejects.toMatchObject(
      { name: "ValidationError", field: "code" },
    );
  });

  it("won't rename a code to an archived one's, but keeps its own", async () => {
    const { repo, update } = promoRepo(promo(), { archivedCodes: ["AUTUMN15"] });
    await expect(new UpdatePromoCode(repo).execute("p1", { ...INPUT, code: "autumn15" }, STAFF)).rejects.toMatchObject({
      field: "code",
      message: "codeArchived",
    });
    await new UpdatePromoCode(repo).execute("p1", { ...INPUT, value: 15 }, STAFF);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("treats an archived code as gone: it can't be edited or switched back on", async () => {
    const { repo, update } = promoRepo(promo({ isActive: false, archivedAt: "2026-01-02T00:00:00.000Z" }));
    await expect(new UpdatePromoCode(repo).execute("p1", INPUT, STAFF)).rejects.toThrow(NotFoundError);
    await expect(new SetPromoCodeActive(repo).execute("p1", true, STAFF)).rejects.toThrow(NotFoundError);
    expect(update).not.toHaveBeenCalled();
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

  it("switches a code saved with a dash before codes were letters and numbers only", async () => {
    const { repo } = promoRepo(promo({ code: "AUTUMN-15", isActive: true }));
    const saved = await new SetPromoCodeActive(repo).execute("p1", false, STAFF);
    expect(saved).toMatchObject({ code: "AUTUMN-15", isActive: false });
  });
});

describe("DeletePromoCode", () => {
  it("is not found for an unknown id", async () => {
    const { repo, remove } = promoRepo(null);
    await expect(new DeletePromoCode(repo).execute("missing", STAFF)).rejects.toThrow(NotFoundError);
    expect(remove).not.toHaveBeenCalled();
  });

  it("deletes a code no order used, and logs what it was", async () => {
    const { repo, remove, archive, entries } = promoRepo(promo());
    expect(await new DeletePromoCode(repo).execute("p1", STAFF)).toBe("deleted");

    expect(archive).not.toHaveBeenCalled();
    expect(remove.mock.calls[0][0]).toBe("p1");
    expect(entries[0]).toMatchObject({
      actorId: "s1",
      action: "promoCode.deleted",
      entityType: "promoCode",
      entityId: "p1",
      entityLabel: "WELCOME10",
    });
    // Every field the code had, with nothing on the "after" side; unset ones are left out.
    expect(entries[0]?.changes.every((change) => change.after === null && change.before !== null)).toBe(true);
    expect(entries[0]?.changes.find((change) => change.field === "code")?.before).toBe("WELCOME10");
    expect(entries[0]?.changes.some((change) => change.field === "endsAt")).toBe(false);
  });

  it("archives a code orders used instead of deleting it, and logs that", async () => {
    const at = new Date("2026-03-01T10:00:00.000Z");
    const { repo, remove, archive, entries } = promoRepo(promo(), { used: true });
    expect(await new DeletePromoCode(repo).execute("p1", STAFF, at)).toBe("archived");

    expect(remove).not.toHaveBeenCalled();
    expect(archive.mock.calls[0].slice(0, 2)).toEqual(["p1", at]);
    expect(entries[0]).toMatchObject({ action: "promoCode.archived", entityId: "p1", entityLabel: "WELCOME10" });
    expect(entries[0]?.changes.find((change) => change.field === "code")).toEqual({
      field: "code",
      before: "WELCOME10",
      after: null,
    });
  });

  it("archives after all when an order took the code between the check and the delete", async () => {
    const { repo, archive, entries } = promoRepo(promo(), { usedMeanwhile: true });
    expect(await new DeletePromoCode(repo).execute("p1", STAFF)).toBe("archived");
    expect(archive).toHaveBeenCalledTimes(1);
    expect(entries.map((entry) => entry?.action)).toEqual(["promoCode.archived"]);
  });

  it("is not found for a code already archived", async () => {
    const { repo, remove, archive } = promoRepo(promo({ archivedAt: "2026-01-02T00:00:00.000Z" }), { used: true });
    await expect(new DeletePromoCode(repo).execute("p1", STAFF)).rejects.toThrow(NotFoundError);
    expect(remove).not.toHaveBeenCalled();
    expect(archive).not.toHaveBeenCalled();
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
  entries: (NewActivityEntry | null)[];
};

function loyaltyRepo(current: LoyaltySettings = DEFAULT_LOYALTY_SETTINGS, lastActivity?: string): LoyaltyFake {
  const entries: (NewActivityEntry | null)[] = [];
  const saveSettings = vi.fn<ILoyaltyRepository["saveSettings"]>(async (settings, audit) => {
    if (audit) entries.push(audit(settings));
    return settings;
  });
  const history = vi.fn<ILoyaltyRepository["history"]>(async (userId) => [transaction({ userId })]);
  const adjust = vi.fn<ILoyaltyRepository["adjust"]>(async (adjustment: PointsAdjustment, audit) => {
    const saved = transaction({
      userId: adjustment.userId,
      delta: adjustment.delta,
      reason: "adjust",
      note: adjustment.note,
    });
    if (audit) entries.push(audit(saved));
    return saved;
  });
  const repo: ILoyaltyRepository = {
    getSettings: vi.fn(async () => current),
    saveSettings,
    balance: vi.fn(async () => 120),
    history,
    adjust,
    lastActivity: vi.fn(async () => lastActivity),
    listLapsing: vi.fn(async () => []),
    expire: vi.fn(async () => 0),
  };
  return { repo, saveSettings, history, adjust, entries };
}

const GUEST: User = {
  id: "09120000000",
  phone: "+989120000000",
  name: "Sara",
  email: null,
  avatarUrl: null,
  role: "customer",
};

function users(...known: User[]): { getById: (id: string) => Promise<User | null> } {
  return { getById: async (id: string): Promise<User | null> => known.find((u) => u.id === id) ?? null };
}

describe("loyalty settings", () => {
  it("reads the settings from the repository", async () => {
    expect(await new GetLoyaltySettings(loyaltyRepo().repo).execute()).toEqual(DEFAULT_LOYALTY_SETTINGS);
  });

  it("saves well-formed settings, and logs what changed", async () => {
    const { repo, saveSettings, entries } = loyaltyRepo();
    const next: LoyaltySettings = {
      enabled: false,
      tomanPerPoint: 5_000,
      pointValue: 500,
      minRedeemPoints: 0,
      pointsExpiryMonths: 0,
    };
    expect(await new UpdateLoyaltySettings(repo).execute(next, STAFF, NOW)).toEqual(next);
    expect(saveSettings).toHaveBeenCalledWith(next, expect.any(Function));
    expect(entries).toEqual([
      expect.objectContaining({
        action: "loyalty.settingsChanged",
        entityType: "loyalty",
        actorId: "s1",
        changes: [
          { field: "enabled", before: "true", after: "false" },
          { field: "tomanPerPoint", before: "10000", after: "5000" },
          { field: "pointValue", before: "1000", after: "500" },
          { field: "minRedeemPoints", before: "50", after: "0" },
        ],
      }),
    ]);
  });

  it("logs nothing when nothing changed", async () => {
    const { repo, entries } = loyaltyRepo();
    await new UpdateLoyaltySettings(repo).execute(DEFAULT_LOYALTY_SETTINGS, STAFF, NOW);
    expect(entries).toEqual([null]);
  });

  it("stamps when expiry was switched on, keeps the stamp while it stays on, and clears it when off", async () => {
    const on = loyaltyRepo();
    const saved = await new UpdateLoyaltySettings(on.repo).execute(
      { ...DEFAULT_LOYALTY_SETTINGS, pointsExpiryMonths: 12 },
      STAFF,
      NOW,
    );
    expect(saved).toMatchObject({ pointsExpiryMonths: 12, pointsExpirySince: NOW.toISOString() });
    expect(on.entries[0]?.changes).toEqual([{ field: "pointsExpiryMonths", before: "0", after: "12" }]);

    const since = "2026-01-01T00:00:00.000Z";
    const longer = loyaltyRepo({ ...DEFAULT_LOYALTY_SETTINGS, pointsExpiryMonths: 12, pointsExpirySince: since });
    await expect(
      new UpdateLoyaltySettings(longer.repo).execute(
        { ...DEFAULT_LOYALTY_SETTINGS, pointsExpiryMonths: 18 },
        STAFF,
        NOW,
      ),
    ).resolves.toMatchObject({ pointsExpirySince: since });
    // Left out, the expiry stays as it is.
    await expect(
      new UpdateLoyaltySettings(longer.repo).execute(
        { enabled: true, tomanPerPoint: 10_000, pointValue: 1_000, minRedeemPoints: 50 },
        STAFF,
        NOW,
      ),
    ).resolves.toMatchObject({ pointsExpiryMonths: 12, pointsExpirySince: since });
    await expect(
      new UpdateLoyaltySettings(longer.repo).execute(
        { ...DEFAULT_LOYALTY_SETTINGS, pointsExpiryMonths: 0 },
        STAFF,
        NOW,
      ),
    ).resolves.toMatchObject({ pointsExpiryMonths: 0, pointsExpirySince: undefined });
  });

  it.each<[Partial<LoyaltySettings>, string]>([
    [{ tomanPerPoint: 0 }, "tomanPerPoint"],
    [{ tomanPerPoint: 1.5 }, "tomanPerPoint"],
    [{ pointValue: -1 }, "pointValue"],
    [{ minRedeemPoints: -1 }, "minRedeemPoints"],
    [{ minRedeemPoints: 0.5 }, "minRedeemPoints"],
    [{ tomanPerPoint: MAX_ORDER_AMOUNT + 1 }, "tomanPerPoint"],
    [{ pointValue: MAX_ORDER_AMOUNT + 1 }, "pointValue"],
    [{ minRedeemPoints: MAX_ORDER_AMOUNT + 1 }, "minRedeemPoints"],
    [{ pointsExpiryMonths: -1 }, "pointsExpiryMonths"],
    [{ pointsExpiryMonths: 121 }, "pointsExpiryMonths"],
    [{ pointsExpiryMonths: 1.5 }, "pointsExpiryMonths"],
  ])("refuses %o", async (overrides, field) => {
    const { repo, saveSettings } = loyaltyRepo();
    await expect(async () =>
      new UpdateLoyaltySettings(repo).execute({ ...DEFAULT_LOYALTY_SETTINGS, ...overrides }, STAFF, NOW),
    ).rejects.toMatchObject({
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
    await expect(new LookupGuestPoints(loyaltyRepo().repo, users(GUEST)).execute("123")).rejects.toThrow(
      ValidationError,
    );
  });

  it("is not found for a phone with no account", async () => {
    await expect(new LookupGuestPoints(loyaltyRepo().repo, users()).execute("09120000000")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("AdjustGuestPoints", () => {
  it("hands the repository a trimmed note attributed to the staff member", async () => {
    const { repo, adjust } = loyaltyRepo();
    await new AdjustGuestPoints(repo, users(GUEST)).execute(
      { phone: "+989120000000", delta: -20, note: "  goodwill  " },
      STAFF,
    );
    expect(adjust).toHaveBeenCalledWith(
      { userId: "09120000000", delta: -20, note: "goodwill", by: STAFF },
      expect.any(Function),
    );
  });

  it("logs the adjustment in the activity log, on the guest", async () => {
    const { repo, entries } = loyaltyRepo();
    await new AdjustGuestPoints(repo, users(GUEST)).execute(
      { phone: "+989120000000", delta: 25, note: "birthday" },
      STAFF,
    );
    expect(entries).toEqual([
      {
        actorId: "s1",
        actorName: "Staff",
        action: "loyalty.pointsAdjusted",
        entityType: "loyalty",
        entityId: "09120000000",
        entityLabel: "Sara (+989120000000)",
        changes: [
          { field: "points", before: null, after: "25" },
          { field: "note", before: null, after: "birthday" },
        ],
      },
    ]);
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

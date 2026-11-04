import {
  activityValue,
  type ActivityActor,
  type ActivityChange,
  type NewActivityEntry,
} from "../../entities/ActivityEntry";
import {
  MAX_LOYALTY_NOTE_LENGTH,
  MAX_POINTS_ADJUSTMENT,
  type GuestLoyaltyLookup,
  type LoyaltyAccount,
  type LoyaltySettings,
  type LoyaltyTransaction,
} from "../../entities/Loyalty";
import { MAX_ORDER_AMOUNT } from "../../entities/Order";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  PROMO_CODE_PATTERN,
  normalizePromoCode,
  type PromoCode,
  type PromoCodeWithUses,
} from "../../entities/Promotion";
import { NotFoundError } from "../../errors/NotFoundError";
import { ResourceInUseError } from "../../errors/ResourceInUseError";
import { ValidationError } from "../../errors/ValidationError";

import type { ILoyaltyRepository } from "../../repositories/ILoyaltyRepository";
import type { IPromotionRepository, PromoCodeInput } from "../../repositories/IPromotionRepository";
import type { IUserRepository } from "../../repositories/IUserRepository";

/** How much of a guest's history the club pages show. */
export const LOYALTY_HISTORY_LIMIT = 30;

/** The fields an edit compares, in the order the activity log lists them. */
const PROMO_FIELDS = [
  "code",
  "description",
  "kind",
  "value",
  "maxDiscount",
  "minSubtotal",
  "startsAt",
  "endsAt",
  "usageLimit",
  "perGuestLimit",
  "isActive",
] as const satisfies readonly (keyof PromoCodeInput)[];

/**
 * The domain's last word on a code, behind the form's schema — so a direct caller
 * can't bypass it. `storedCode` is the code as saved when editing: one saved before
 * codes were letters and numbers only ("AUTUMN-15") is kept as long as it isn't
 * changed, so switching it on or off from the list still works.
 */
function validatePromo(input: PromoCodeInput, storedCode?: string): PromoCodeInput {
  const code = normalizePromoCode(input.code);
  if (code !== storedCode && !PROMO_CODE_PATTERN.test(code)) {
    throw new ValidationError("code", "Codes use letters and numbers only, 3 to 16 of them.");
  }
  if (!Number.isInteger(input.value) || input.value <= 0)
    throw new ValidationError("value", "Enter how much it takes off.");
  if (input.kind === "percent" && input.value > 100)
    throw new ValidationError("value", "A percentage can't be over 100.");
  for (const field of ["value", "maxDiscount", "minSubtotal"] as const) {
    const amount = input[field];
    if (amount !== undefined && amount > MAX_ORDER_AMOUNT)
      throw new ValidationError(field, "That amount is too large.");
  }
  if (input.description && input.description.length > MAX_PROMO_DESCRIPTION_LENGTH) {
    throw new ValidationError("description", "That description is too long.");
  }
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) {
    throw new ValidationError("endsAt", "The end must be after the start.");
  }
  return { ...input, code, description: input.description?.trim() || undefined };
}

function promoChanges(before: PromoCode | null, after: PromoCode): ActivityChange[] {
  return PROMO_FIELDS.filter((field) => before === null || before[field] !== after[field]).map((field) => ({
    field,
    before: before ? activityValue(before[field]) : null,
    after: activityValue(after[field]),
  }));
}

/**
 * A code staff can't take because a deleted code that orders used still holds it.
 *
 * Refused rather than reused or quietly allowed: a new code under the old name
 * would be a new row with no uses, so every guest who had already used it up would
 * get its per-guest limit afresh — and a guest reading "AUTUMN15" on an old receipt
 * and on a new offer would take them for the same deal. A field error, so the form
 * says why on the code itself (`codeArchived`).
 */
async function refuseArchivedCode(
  promoRepo: Pick<IPromotionRepository, "getArchivedByCode">,
  code: string,
): Promise<void> {
  if (await promoRepo.getArchivedByCode(code)) throw new ValidationError("code", "codeArchived");
}

/** Staff create a promo code. A code that's already taken is a 409; one a deleted, used code holds is a 400. */
export class CreatePromoCode {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  async execute(input: PromoCodeInput, staff: ActivityActor): Promise<PromoCode> {
    const valid = validatePromo(input);
    await refuseArchivedCode(this.promoRepo, valid.code);
    return this.promoRepo.create(valid, (saved) => ({
      actorId: staff.id,
      actorName: staff.name,
      action: "promoCode.created",
      entityType: "promoCode",
      entityId: saved.id,
      entityLabel: saved.code,
      changes: promoChanges(null, saved),
    }));
  }
}

/**
 * Staff edit a promo code. Orders already placed with it keep the discount they got.
 * An archived code is gone to staff: not found, so it can't be edited or switched
 * back on.
 */
export class UpdatePromoCode {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  async execute(id: string, input: PromoCodeInput, staff: ActivityActor): Promise<PromoCode> {
    const current = await this.promoRepo.getById(id);
    if (!current || current.archivedAt) throw new NotFoundError("promo code", id);
    const valid = validatePromo(input, current.code);
    if (valid.code !== current.code) await refuseArchivedCode(this.promoRepo, valid.code);
    return this.promoRepo.update(id, valid, (saved) => {
      const changes = promoChanges(current, saved);
      if (changes.length === 0) return null;
      const onlyActive = changes.length === 1 && changes[0].field === "isActive";
      return {
        actorId: staff.id,
        actorName: staff.name,
        action: onlyActive ? "promoCode.activeChanged" : "promoCode.updated",
        entityType: "promoCode",
        entityId: saved.id,
        entityLabel: saved.code,
        changes,
      };
    });
  }
}

/** Switch a code on or off from the list, keeping everything else. */
export class SetPromoCodeActive {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  async execute(id: string, isActive: boolean, staff: ActivityActor): Promise<PromoCode> {
    const current = await this.promoRepo.getById(id);
    if (!current || current.archivedAt) throw new NotFoundError("promo code", id);
    if (current.isActive === isActive) return current;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, archivedAt: _archivedAt, ...input } = current;
    return new UpdatePromoCode(this.promoRepo).execute(id, { ...input, isActive }, staff);
  }
}

/** How a promo code left the list: removed for good, or archived because orders used it. */
export type PromoCodeRemoval = "deleted" | "archived";

/**
 * Delete a code. Guests can't use it any more; orders that already did keep their
 * discount. The log keeps what the code was.
 *
 * A code no order ever carried is removed for good. One that orders used is
 * archived instead (`PromoCode.archivedAt`): those orders carry its id, and when
 * staff change one later it's re-priced with the code it was placed with, so the
 * code must still be there to read — and its code stays taken, so re-creating it
 * can't hand guests its per-guest limit again. To staff the two look the same: the
 * code leaves the list.
 */
export class DeletePromoCode {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  async execute(id: string, staff: ActivityActor, now: Date = new Date()): Promise<PromoCodeRemoval> {
    const current = await this.promoRepo.getById(id);
    if (!current || current.archivedAt) throw new NotFoundError("promo code", id);

    const entry = (action: "promoCode.deleted" | "promoCode.archived"): NewActivityEntry => ({
      actorId: staff.id,
      actorName: staff.name,
      action,
      entityType: "promoCode",
      entityId: id,
      entityLabel: current.code,
      // What the code was, every set field going away — the same for both: either
      // way it's gone from the dashboard, and the entry is where it's remembered.
      changes: promoChanges(null, current)
        .map(({ field, after }) => ({ field, before: after, after: null }))
        .filter((change) => change.before !== null),
    });
    const archive = async (): Promise<PromoCodeRemoval> => {
      await this.promoRepo.archive(id, now, () => entry("promoCode.archived"));
      return "archived";
    };

    if (await this.promoRepo.isUsed(id)) return archive();
    try {
      await this.promoRepo.delete(id, () => entry("promoCode.deleted"));
      return "deleted";
    } catch (error) {
      // An order took the code between the check and the delete: archive it after all.
      if (error instanceof ResourceInUseError) return archive();
      throw error;
    }
  }
}

export class ListPromoCodes {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  execute(): Promise<PromoCodeWithUses[]> {
    return this.promoRepo.list();
  }
}

export class GetLoyaltySettings {
  constructor(private readonly loyaltyRepo: ILoyaltyRepository) {}

  execute(): Promise<LoyaltySettings> {
    return this.loyaltyRepo.getSettings();
  }
}

/** Staff tune the club: how points are earned, what they're worth, the least a guest can spend. */
export class UpdateLoyaltySettings {
  constructor(private readonly loyaltyRepo: ILoyaltyRepository) {}

  execute(settings: LoyaltySettings): Promise<LoyaltySettings> {
    for (const field of ["tomanPerPoint", "pointValue"] as const) {
      if (!Number.isInteger(settings[field]) || settings[field] < 1)
        throw new ValidationError(field, "Enter a whole number above zero.");
    }
    if (!Number.isInteger(settings.minRedeemPoints) || settings.minRedeemPoints < 0) {
      throw new ValidationError("minRedeemPoints", "Enter a whole number.");
    }
    for (const field of ["tomanPerPoint", "pointValue", "minRedeemPoints"] as const) {
      if (settings[field] > MAX_ORDER_AMOUNT) throw new ValidationError(field, "That number is too large.");
    }
    return this.loyaltyRepo.saveSettings(settings);
  }
}

/** The signed-in guest's balance and recent points. */
export class GetOwnLoyaltyAccount {
  constructor(private readonly loyaltyRepo: ILoyaltyRepository) {}

  async execute(guestId: string): Promise<LoyaltyAccount> {
    const [balance, history] = await Promise.all([
      this.loyaltyRepo.balance(guestId),
      this.loyaltyRepo.history(guestId, LOYALTY_HISTORY_LIMIT),
    ]);
    return { balance, history };
  }
}

/** Staff look a guest up by phone. A phone with no account is not found — points live on accounts. */
export class LookupGuestPoints {
  constructor(
    private readonly loyaltyRepo: ILoyaltyRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(phone: string): Promise<GuestLoyaltyLookup> {
    if (!isPlausiblePhone(phone)) throw new ValidationError("phone", "Enter a valid phone number.");
    // A user's id is their normalized phone, so this is the account lookup.
    const user = await this.userRepo.getById(normalizePhone(phone));
    if (!user) throw new NotFoundError("guest", phone);
    const account = await new GetOwnLoyaltyAccount(this.loyaltyRepo).execute(user.id);
    return { ...account, userId: user.id, name: user.name };
  }
}

/** Staff add or take away a guest's points by hand, with a reason. */
export class AdjustGuestPoints {
  constructor(
    private readonly loyaltyRepo: ILoyaltyRepository,
    private readonly userRepo: Pick<IUserRepository, "getById">,
  ) {}

  async execute(
    input: { phone: string; delta: number; note: string },
    staff: ActivityActor,
  ): Promise<LoyaltyTransaction> {
    if (!isPlausiblePhone(input.phone)) throw new ValidationError("phone", "Enter a valid phone number.");
    if (!Number.isInteger(input.delta) || input.delta === 0 || Math.abs(input.delta) > MAX_POINTS_ADJUSTMENT) {
      throw new ValidationError("delta", "Enter a whole number of points.");
    }
    const note = input.note.trim();
    if (!note) throw new ValidationError("note", "Say why.");
    if (note.length > MAX_LOYALTY_NOTE_LENGTH) throw new ValidationError("note", "That note is too long.");

    const user = await this.userRepo.getById(normalizePhone(input.phone));
    if (!user) throw new NotFoundError("guest", input.phone);
    return this.loyaltyRepo.adjust({ userId: user.id, delta: input.delta, note, by: staff });
  }
}

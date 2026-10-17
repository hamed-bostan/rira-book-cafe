import { activityValue, type ActivityActor, type ActivityChange } from "../../entities/ActivityEntry";
import {
  MAX_LOYALTY_NOTE_LENGTH,
  MAX_POINTS_ADJUSTMENT,
  type GuestLoyaltyLookup,
  type LoyaltyAccount,
  type LoyaltySettings,
  type LoyaltyTransaction,
} from "../../entities/Loyalty";
import { isPlausiblePhone, normalizePhone } from "../../entities/Phone";
import {
  MAX_PROMO_DESCRIPTION_LENGTH,
  PROMO_CODE_PATTERN,
  normalizePromoCode,
  type PromoCode,
  type PromoCodeWithUses,
} from "../../entities/Promotion";
import { NotFoundError } from "../../errors/NotFoundError";
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

/** The domain's last word on a code, behind the form's schema — so a direct caller can't bypass it. */
function validatePromo(input: PromoCodeInput): PromoCodeInput {
  const code = normalizePromoCode(input.code);
  if (!PROMO_CODE_PATTERN.test(code)) throw new ValidationError("code", "Use 3–20 letters, digits, - or _.");
  if (!Number.isInteger(input.value) || input.value <= 0) throw new ValidationError("value", "Enter how much it takes off.");
  if (input.kind === "percent" && input.value > 100) throw new ValidationError("value", "A percentage can't be over 100.");
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

/** Staff create a promo code. A code that's already taken is a 409. */
export class CreatePromoCode {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  execute(input: PromoCodeInput, staff: ActivityActor): Promise<PromoCode> {
    return this.promoRepo.create(validatePromo(input), (saved) => ({
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

/** Staff edit a promo code. Orders already placed with it keep the discount they got. */
export class UpdatePromoCode {
  constructor(private readonly promoRepo: IPromotionRepository) {}

  async execute(id: string, input: PromoCodeInput, staff: ActivityActor): Promise<PromoCode> {
    const current = await this.promoRepo.getById(id);
    if (!current) throw new NotFoundError("promo code", id);
    return this.promoRepo.update(id, validatePromo(input), (saved) => {
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
    if (!current) throw new NotFoundError("promo code", id);
    if (current.isActive === isActive) return current;
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...input } = current;
    return new UpdatePromoCode(this.promoRepo).execute(id, { ...input, isActive }, staff);
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
      if (!Number.isInteger(settings[field]) || settings[field] < 1) throw new ValidationError(field, "Enter a whole number above zero.");
    }
    if (!Number.isInteger(settings.minRedeemPoints) || settings.minRedeemPoints < 0) {
      throw new ValidationError("minRedeemPoints", "Enter a whole number.");
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

  async execute(input: { phone: string; delta: number; note: string }, staff: ActivityActor): Promise<LoyaltyTransaction> {
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

import { singleChange, type ActivityActor } from "../../entities/ActivityEntry";
import { isSuiteNightlyRate, type SuiteSettings } from "../../entities/SuitePricing";
import { NotFoundError } from "../../errors/NotFoundError";
import { ValidationError } from "../../errors/ValidationError";

import type { SuiteBooking } from "../../entities/SuiteBooking";
import type { ISuiteBookingRepository } from "../../repositories/ISuiteBookingRepository";
import type { ISuitePricingRepository } from "../../repositories/ISuitePricingRepository";

function checkRate(rate: number): void {
  if (!isSuiteNightlyRate(rate)) throw new ValidationError("nightlyRate", "Enter what a night costs.");
}

/** Change what a night in the suite costs. Stays already made keep the rate they were made at. */
export class UpdateSuitePrice {
  constructor(private readonly pricing: ISuitePricingRepository) {}

  async execute(settings: SuiteSettings, actor: ActivityActor): Promise<SuiteSettings> {
    checkRate(settings.nightlyRate);
    const before = await this.pricing.getSettings();
    return this.pricing.updateSettings(settings, (saved) =>
      saved.nightlyRate === before.nightlyRate
        ? null
        : {
            actorId: actor.id,
            actorName: actor.name,
            action: "suiteBooking.priceChanged",
            entityType: "suiteBooking",
            entityId: "settings",
            entityLabel: "Suite price",
            changes: singleChange("nightlyRate", before.nightlyRate, saved.nightlyRate),
          },
    );
  }
}

/**
 * Price one stay differently — a returning guest's rate, a long-stay discount, a
 * stay from before the suite had a price. Its total follows: nights × this rate.
 */
export class SetSuiteStayRate {
  constructor(
    private readonly stays: Pick<ISuiteBookingRepository, "getById">,
    private readonly pricing: ISuitePricingRepository,
  ) {}

  async execute(id: string, nightlyRate: number, actor: ActivityActor): Promise<SuiteBooking> {
    checkRate(nightlyRate);
    const current = await this.stays.getById(id);
    if (!current) throw new NotFoundError("suite booking", id);
    if (current.nightlyRate === nightlyRate) return current;

    return this.pricing.setStayRate(id, nightlyRate, (saved) => ({
      actorId: actor.id,
      actorName: actor.name,
      action: "suiteBooking.rateChanged",
      entityType: "suiteBooking",
      entityId: saved.id,
      entityLabel: `S-${saved.reference}`,
      changes: singleChange("nightlyRate", current.nightlyRate, saved.nightlyRate),
    }));
  }
}

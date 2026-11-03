import { describe, expect, it, vi } from "vitest";

import { NotFoundError } from "../../../errors/NotFoundError";
import { ValidationError } from "../../../errors/ValidationError";
import { SetSuiteStayRate, UpdateSuitePrice } from "../SuitePricing";

import type { SuiteBooking } from "../../../entities/SuiteBooking";
import type { ISuitePricingRepository } from "../../../repositories/ISuitePricingRepository";

const ACTOR = { id: "owner", name: "Rira" };

const STAY = { id: "s1", reference: 12, nightlyRate: 2_500_000 } as SuiteBooking;

function pricing(): ISuitePricingRepository & {
  updateSettings: ReturnType<typeof vi.fn<ISuitePricingRepository["updateSettings"]>>;
  setStayRate: ReturnType<typeof vi.fn<ISuitePricingRepository["setStayRate"]>>;
} {
  return {
    getSettings: vi.fn(async () => ({ nightlyRate: 2_500_000 })),
    updateSettings: vi.fn<ISuitePricingRepository["updateSettings"]>(async (settings) => settings),
    setStayRate: vi.fn<ISuitePricingRepository["setStayRate"]>(async (_id, nightlyRate) => ({
      ...STAY,
      nightlyRate,
    })),
  };
}

describe("UpdateSuitePrice", () => {
  it("saves what a night costs and logs the change", async () => {
    const repo = pricing();
    const saved = await new UpdateSuitePrice(repo).execute({ nightlyRate: 3_000_000 }, ACTOR);

    expect(saved).toEqual({ nightlyRate: 3_000_000 });
    expect(repo.updateSettings.mock.calls[0][1]?.(saved)).toMatchObject({
      action: "suiteBooking.priceChanged",
      changes: [{ field: "nightlyRate", before: "2500000", after: "3000000" }],
    });
  });

  it("logs nothing when the price didn't move, and refuses a price that isn't one", async () => {
    const repo = pricing();
    await new UpdateSuitePrice(repo).execute({ nightlyRate: 2_500_000 }, ACTOR);

    expect(repo.updateSettings.mock.calls[0][1]?.({ nightlyRate: 2_500_000 })).toBeNull();
    await expect(new UpdateSuitePrice(repo).execute({ nightlyRate: -1 }, ACTOR)).rejects.toThrow(ValidationError);
    await expect(new UpdateSuitePrice(repo).execute({ nightlyRate: 1.5 }, ACTOR)).rejects.toThrow(ValidationError);
  });
});

describe("SetSuiteStayRate", () => {
  it("prices one stay at its own rate", async () => {
    const repo = pricing();
    const saved = await new SetSuiteStayRate({ getById: vi.fn(async () => STAY) }, repo).execute(
      "s1",
      2_000_000,
      ACTOR,
    );

    expect(saved.nightlyRate).toBe(2_000_000);
    expect(repo.setStayRate.mock.calls[0][2]?.(saved)).toMatchObject({
      action: "suiteBooking.rateChanged",
      entityLabel: "S-12",
      changes: [{ field: "nightlyRate", before: "2500000", after: "2000000" }],
    });
  });

  it("leaves a stay already at that rate alone, and refuses one that isn't there", async () => {
    const repo = pricing();

    await expect(
      new SetSuiteStayRate({ getById: vi.fn(async () => STAY) }, repo).execute("s1", 2_500_000, ACTOR),
    ).resolves.toBe(STAY);
    expect(repo.setStayRate).not.toHaveBeenCalled();
    await expect(
      new SetSuiteStayRate({ getById: vi.fn(async () => null) }, repo).execute("s1", 2_000_000, ACTOR),
    ).rejects.toThrow(NotFoundError);
  });
});

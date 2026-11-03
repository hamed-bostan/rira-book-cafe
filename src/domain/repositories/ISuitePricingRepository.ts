import type { AuditHook } from "./AuditHook";
import type { SuiteBooking } from "../entities/SuiteBooking";
import type { SuiteSettings } from "../entities/SuitePricing";

/**
 * The suite's price: what a night costs for new stays, and one stay's own rate.
 * New stays snapshot the price as they're made (`ISuiteBookingRepository.create`,
 * and a confirm of a stay that has none).
 */
export type ISuitePricingRepository = {
  getSettings(): Promise<SuiteSettings>;
  updateSettings(settings: SuiteSettings, audit?: AuditHook<SuiteSettings>): Promise<SuiteSettings>;
  /** Set one stay's nightly rate; its total follows. `NotFoundError` for an unknown stay. */
  setStayRate(id: string, nightlyRate: number, audit?: AuditHook<SuiteBooking>): Promise<SuiteBooking>;
};

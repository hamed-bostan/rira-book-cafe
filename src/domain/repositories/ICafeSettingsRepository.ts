import type { AuditHook } from "./AuditHook";
import type { CafeProfile, CafeSettings, OpeningHours, ReceiptSettings } from "../entities/CafeSettings";

/**
 * The cafe's own configuration — one record, read whole and written a section at
 * a time (profile, hours, receipt). Each write records its audit entry in the
 * same transaction.
 */
export type ICafeSettingsRepository = {
  /** What's set; `EMPTY_CAFE_SETTINGS` before anything is. */
  get(): Promise<CafeSettings>;
  updateProfile(profile: CafeProfile, audit?: AuditHook<CafeSettings>): Promise<CafeSettings>;
  updateHours(hours: OpeningHours, audit?: AuditHook<CafeSettings>): Promise<CafeSettings>;
  updateReceipt(receipt: ReceiptSettings, audit?: AuditHook<CafeSettings>): Promise<CafeSettings>;
};

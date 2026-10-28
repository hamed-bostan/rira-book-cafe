import type { AuditHook } from "./AuditHook";
import type { PromoCode, PromoCodeWithUses, PromoUsage } from "../entities/Promotion";

/** A code as staff write it. Id and timestamps are the repository's. */
export type PromoCodeInput = Omit<PromoCode, "id" | "createdAt" | "updatedAt">;

export type IPromotionRepository = {
  /** Every code, newest first, with its live uses. */
  list(): Promise<PromoCodeWithUses[]>;
  getById(id: string): Promise<PromoCode | null>;
  /**
   * The code a guest typed (normalized — see `normalizePromoCode`), matched on its
   * letters and numbers alone (`promoCodeKey`), so separators and case don't
   * matter. A code saved exactly as typed wins over one that only matches without
   * its separators; when several match only that way and none is the plain
   * letters-and-numbers code, there's no telling which was meant — `null`.
   */
  getByCode(code: string): Promise<PromoCode | null>;
  /** How many live (not cancelled) orders carry the code — in all, and the guest's. */
  usage(promoId: string, userId: string): Promise<PromoUsage>;
  /** A taken code is `UniqueConstraintError(["code"])`. */
  create(input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode>;
  update(id: string, input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode>;
  /**
   * Remove a code for good. Orders that used it keep their snapshotted code and
   * discount — they reference it by id without a foreign key.
   */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;
};

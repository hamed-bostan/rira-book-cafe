import type { AuditHook } from "./AuditHook";
import type { PromoCode, PromoCodeWithUses, PromoUsage } from "../entities/Promotion";

/** A code as staff write it. Id, timestamps and archiving are the repository's. */
export type PromoCodeInput = Omit<PromoCode, "id" | "createdAt" | "updatedAt" | "archivedAt">;

export type IPromotionRepository = {
  /** Every code still in use (not archived), newest first, with its live uses. */
  list(): Promise<PromoCodeWithUses[]>;
  /**
   * One code by id — archived ones too, since an order that used a code reads it
   * back by the id it carries.
   */
  getById(id: string): Promise<PromoCode | null>;
  /**
   * The code a guest typed (normalized — see `normalizePromoCode`), matched on its
   * letters and numbers alone (`promoCodeKey`), so separators and case don't
   * matter. A code saved exactly as typed wins over one that only matches without
   * its separators; when several match only that way and none is the plain
   * letters-and-numbers code, there's no telling which was meant — `null`.
   * Archived codes are never found: they can't be used again.
   */
  getByCode(code: string): Promise<PromoCode | null>;
  /** The archived code saved as exactly `code`, if there is one — its code stays taken. */
  getArchivedByCode(code: string): Promise<PromoCode | null>;
  /** How many live (not cancelled) orders carry the code — in all, and the guest's. */
  usage(promoId: string, userId: string): Promise<PromoUsage>;
  /** Whether any order, in any state (cancelled ones too), ever carried the code. */
  isUsed(promoId: string): Promise<boolean>;
  /** A taken code is `UniqueConstraintError(["code"])`. */
  create(input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode>;
  update(id: string, input: PromoCodeInput, audit?: AuditHook<PromoCode>): Promise<PromoCode>;
  /**
   * Remove a code no order ever carried, for good. Refused with
   * `ResourceInUseError` when an order carries it after all — one placed since the
   * caller checked `isUsed` — so a used code is never removed from under its orders.
   */
  delete(id: string, audit?: AuditHook<void>): Promise<void>;
  /**
   * Archive a code (see `PromoCode.archivedAt`): stamped `at` and switched off, in
   * one transaction with its audit entry. Serialized with checkout's claim on the
   * code, so no order takes it once this commits.
   */
  archive(id: string, at: Date, audit?: AuditHook<PromoCode>): Promise<PromoCode>;
};

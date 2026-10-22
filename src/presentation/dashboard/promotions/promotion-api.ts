import type {
  LoyaltySettingsInput,
  PointsAdjustmentInput,
  PromoCodeActiveInput,
  PromoCodeFormInput,
} from "@/src/contracts/promotion-schema";
import type { GuestLoyaltyLookup, LoyaltySettings, LoyaltyTransaction } from "@/src/domain/entities/Loyalty";
import type { PromoCode } from "@/src/domain/entities/Promotion";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/src/lib/api/client";
import {
  guestLoyaltyLookupResponseSchema,
  loyaltySettingsResponseSchema,
  loyaltyTransactionResponseSchema,
  promoCodeResponseSchema,
} from "@/src/presentation/loyalty/loyalty-response-schema";

/** Typed client for the dashboard's promotions; components `router.refresh()` after a write. */
export const promotionsApi = {
  /** 409 when the code is taken. */
  createPromoCode(values: PromoCodeFormInput): Promise<PromoCode> {
    return apiPost("/admin/promo-codes", values, promoCodeResponseSchema);
  },

  updatePromoCode(id: string, values: PromoCodeFormInput): Promise<PromoCode> {
    return apiPut(`/admin/promo-codes/${id}`, values, promoCodeResponseSchema);
  },

  setPromoCodeActive(id: string, values: PromoCodeActiveInput): Promise<PromoCode> {
    return apiPatch(`/admin/promo-codes/${id}`, values, promoCodeResponseSchema);
  },

  /** Orders that used it keep their discount. */
  removePromoCode(id: string): Promise<void> {
    return apiDelete(`/admin/promo-codes/${id}`);
  },

  saveLoyaltySettings(values: LoyaltySettingsInput): Promise<LoyaltySettings> {
    return apiPut("/admin/loyalty/settings", values, loyaltySettingsResponseSchema);
  },

  /** A guest's points by phone. 404 when no account has it. */
  lookupGuest(phone: string): Promise<GuestLoyaltyLookup> {
    return apiGet("/admin/loyalty/guests", guestLoyaltyLookupResponseSchema, { params: { phone } });
  },

  /** 409 `NOT_ENOUGH_POINTS` when taking more than they have. */
  adjustPoints(values: PointsAdjustmentInput): Promise<LoyaltyTransaction> {
    return apiPost("/admin/loyalty/adjustments", values, loyaltyTransactionResponseSchema);
  },
};

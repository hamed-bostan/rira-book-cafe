import type { LoyaltySettings } from "@/src/domain/entities/Loyalty";
import type { PromoCodeWithUses } from "@/src/domain/entities/Promotion";
import { serverApiGet } from "@/src/lib/api/server-client";
import {
  loyaltySettingsResponseSchema,
  promoCodeListResponseSchema,
} from "@/src/presentation/loyalty/loyalty-response-schema";

/** Server-side promotion reads for the dashboard (BFF), fetched during server render. */
export const promotionsServerApi = {
  listPromoCodes(): Promise<PromoCodeWithUses[]> {
    return serverApiGet("/admin/promo-codes", promoCodeListResponseSchema);
  },

  loyaltySettings(): Promise<LoyaltySettings> {
    return serverApiGet("/admin/loyalty/settings", loyaltySettingsResponseSchema);
  },
};

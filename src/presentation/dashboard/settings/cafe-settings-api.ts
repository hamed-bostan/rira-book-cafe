import type {
  CafeProfileFormInput,
  OpeningHoursFormInput,
  ReceiptSettingsFormInput,
} from "@/src/contracts/cafe-settings-schema";
import type { CafeSettings } from "@/src/domain/entities/CafeSettings";
import { apiPut } from "@/src/lib/api/client";
import { cafeSettingsResponseSchema } from "@/src/presentation/settings/cafe-settings-response-schema";

/**
 * Typed client for the cafe's settings writes, one per section. Each resolves with
 * every setting as saved, or rejects with an `ApiError`. Reads are server-side
 * (`cafeSettingsServerApi`).
 */
export const cafeSettingsApi = {
  updateProfile(values: CafeProfileFormInput): Promise<CafeSettings> {
    return apiPut("/admin/settings/profile", values, cafeSettingsResponseSchema);
  },

  updateHours(values: OpeningHoursFormInput): Promise<CafeSettings> {
    return apiPut("/admin/settings/hours", values, cafeSettingsResponseSchema);
  },

  updateReceipt(values: ReceiptSettingsFormInput): Promise<CafeSettings> {
    return apiPut("/admin/settings/receipt", values, cafeSettingsResponseSchema);
  },
};

import type { SuiteSettings } from "@/src/domain/entities/SuitePricing";
import { serverApiGet } from "@/src/lib/api/server-client";

import { suiteSettingsResponseSchema } from "./suite-price-response-schema";

/** Server-side reads of the suite's price (BFF), fetched during server render. */
export const suitePricesServerApi = {
  /** What a night costs for new stays. */
  getDefault(): Promise<SuiteSettings> {
    return serverApiGet("/admin/suite-bookings/settings", suiteSettingsResponseSchema);
  },
};

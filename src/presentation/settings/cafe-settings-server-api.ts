import { cache } from "react";

import { EMPTY_CAFE_SETTINGS, type CafeSettings } from "@/src/domain/entities/CafeSettings";
import { serverApiGet } from "@/src/lib/api/server-client";
import { CATALOG_TAGS } from "@/src/lib/cache-tags";

import { cafeSettingsResponseSchema } from "./cafe-settings-response-schema";

// The same for every visitor, so it's served from Next's data cache under its tag —
// expired the moment a settings write succeeds — and memoized per request, since a
// page's metadata, its JSON-LD and its body may each ask for it.
const readCached = cache((): Promise<CafeSettings> =>
  serverApiGet("/settings", cafeSettingsResponseSchema, { cache: { tags: [CATALOG_TAGS.settings] } }),
);

/** Server-side reads of the cafe's settings (BFF), fetched during server render. */
export const cafeSettingsServerApi = {
  /** What the site shows: cached, and expired by every settings write. Rejects with `ApiError`. */
  get(): Promise<CafeSettings> {
    return readCached();
  },

  /**
   * The same, for a part of a public page that can do without it (the hours on the
   * home page, the name in structured data): when the read fails, the page renders
   * as it would before anything was set, rather than failing whole.
   */
  async getOrEmpty(): Promise<CafeSettings> {
    try {
      return await readCached();
    } catch {
      return EMPTY_CAFE_SETTINGS;
    }
  },

  /** The settings as stored right now, for the dashboard form that edits them — never cached. */
  getLatest(): Promise<CafeSettings> {
    return serverApiGet("/settings", cafeSettingsResponseSchema, { canonical: true });
  },
};

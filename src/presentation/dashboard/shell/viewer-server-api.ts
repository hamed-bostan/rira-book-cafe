import { serverApiGet } from "@/src/lib/api/server-client";

import { viewerResponseSchema, type ViewerWire } from "./viewer-response-schema";

/**
 * Server-side "who am I" read for the dashboard shell (BFF). `serverApiGet`
 * forwards the admin's session cookie so `/admin/me` resolves the caller's own
 * record from it.
 */
export const viewerServerApi = {
  get(): Promise<ViewerWire> {
    return serverApiGet("/admin/me", viewerResponseSchema);
  },
};

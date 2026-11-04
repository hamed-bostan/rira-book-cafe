import { apiClient } from "@/src/lib/api/client";

/**
 * Where the browser downloads the activity log as CSV — a plain link rather than a
 * call: the browser saves the file, and the session cookie goes with it. The log
 * has no writes, so this is the whole browser-side service.
 */
export const activityExports = {
  csvHref(params: Record<string, string>): string {
    return apiClient.getUri({ url: "/admin/activity/export", params });
  },
};

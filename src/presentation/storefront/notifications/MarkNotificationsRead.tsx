"use client";

import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";

import { storefrontApi } from "../storefront-api";

/**
 * Opening the notifications page reads them: once the page has shown the unread
 * ones highlighted, mark everything read and refresh so the header's badge clears.
 * Renders nothing; a failure just leaves them unread for next time.
 */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  const router = useRouter();

  React.useEffect(() => {
    if (unread === 0) return;
    let cancelled = false;
    storefrontApi
      .markNotificationsRead()
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [unread, router]);

  return null;
}

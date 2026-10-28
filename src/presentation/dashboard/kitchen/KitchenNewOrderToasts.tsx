"use client";

import * as React from "react";

import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

export type KitchenNewOrderNotice = {
  id: string;
  /** "New order #232 · Table 3", translated on the server. */
  text: string;
};

/**
 * Announces orders that arrived since the board last refreshed: each refresh
 * brings the "New" lane again, and any order that wasn't in it last time gets a
 * toast. The first render only takes note of what's there — the board was opened
 * on those, they aren't news. An order someone moved on between two refreshes
 * never shows here, and neither does one the bar moved on itself.
 */
export function KitchenNewOrderToasts({ notices }: { notices: readonly KitchenNewOrderNotice[] }) {
  const { toast } = useToast();
  const seen = React.useRef<ReadonlySet<string> | null>(null);

  React.useEffect(() => {
    const previous = seen.current;
    // Only the lane as it is now: an order leaves "New" for good once it's taken.
    seen.current = new Set(notices.map((notice) => notice.id));
    if (!previous) return;
    for (const notice of notices) {
      if (!previous.has(notice.id)) toast({ tone: "info", title: notice.text });
    }
  }, [notices, toast]);

  return null;
}

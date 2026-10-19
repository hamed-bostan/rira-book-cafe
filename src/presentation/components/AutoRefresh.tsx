"use client";

import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";

type AutoRefreshProps = {
  /** How often to re-run the server render, in seconds. */
  intervalSeconds: number;
};

/**
 * Re-runs the page's server render on an interval while the tab is visible, so a
 * screen left open at the counter picks up new orders without anyone pressing
 * reload. A refresh rather than a client fetch: the server render stays the single
 * source of truth, exactly as after a mutation.
 *
 * Paused while the tab is hidden (no point polling a screen nobody is looking at),
 * and refreshes immediately when it comes back. Also refreshes once on mount: going
 * back to a live screen can show it from the client router cache (`staleTimes`), up
 * to half a minute old, so it catches up in the background straight away.
 */
export function AutoRefresh({ intervalSeconds }: AutoRefreshProps) {
  const router = useRouter();

  React.useEffect(() => {
    let timer: number | undefined;

    function start(): void {
      stop();
      timer = window.setInterval(() => router.refresh(), intervalSeconds * 1000);
    }
    function stop(): void {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
    }
    function onVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") {
      router.refresh();
      start();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router, intervalSeconds]);

  return null;
}

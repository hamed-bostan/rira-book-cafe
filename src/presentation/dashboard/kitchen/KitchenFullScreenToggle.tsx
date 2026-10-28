"use client";

import { Maximize, Minimize } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { DASHBOARD_FULL_SCREEN_ATTRIBUTE } from "../shell/fullScreen";

/**
 * Puts the board on the whole screen for a wall display: the dashboard's rail,
 * top bar and bottom tabs step aside (see `shell/fullScreen.ts`) and the lanes get
 * the width. Esc or the same button brings the chrome back, and leaving the page
 * always does.
 *
 * A layout mode rather than the browser's Fullscreen API on purpose: the board's
 * toasts ("New order #232") portal to `<body>`, and an element in browser
 * full screen would hide them.
 */
export function KitchenFullScreenToggle() {
  const t = useTranslations("dashKitchen");
  const [fullScreen, setFullScreen] = React.useState(false);

  React.useEffect(() => {
    if (!fullScreen) return;
    const root = document.documentElement;
    root.setAttribute(DASHBOARD_FULL_SCREEN_ATTRIBUTE, "");

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !event.defaultPrevented) setFullScreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.removeAttribute(DASHBOARD_FULL_SCREEN_ATTRIBUTE);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [fullScreen]);

  return (
    <Button
      type="button"
      variant="secondary"
      size="control-md"
      className="px-3 whitespace-nowrap"
      aria-pressed={fullScreen}
      onClick={() => setFullScreen((current) => !current)}
    >
      <Icon icon={fullScreen ? Minimize : Maximize} size="icon-md" className="me-2" />
      {t(fullScreen ? "exitFullScreen" : "fullScreen")}
    </Button>
  );
}

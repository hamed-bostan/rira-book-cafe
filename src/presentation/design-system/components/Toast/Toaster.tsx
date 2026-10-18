"use client";

import { useTranslations } from "next-intl";
import { Direction, Toast } from "radix-ui";
import * as React from "react";

import { ToastContext } from "./ToastContext";
import { ToastItem } from "./ToastItem";

import type { ToastApi, ToastOptions, ToastRecord } from "./toastTypes";

/** More than this and the oldest are dropped — a wall of toasts is noise, not feedback. */
const MAX_VISIBLE = 3;

/** Matches the toast's exit animation, so it's unmounted only once it has left. */
const EXIT_MS = 200;

/**
 * App-wide toast host, built on Radix Toast. Mount once near the root (inside the
 * intl and direction providers); anything below can call `useToast()`.
 *
 * Docked at the top on phones — the bottom belongs to the tab bar and the
 * thumb — and at the bottom inline-end from `sm`. Swiping toward the inline-end
 * edge dismisses, so the gesture flips with the reading direction.
 */
export function Toaster({ children }: { children: React.ReactNode }) {
  const t = useTranslations("ds");
  const dir = Direction.useDirection();
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const nextId = React.useRef(0);

  const dismiss = React.useCallback((id: number): void => {
    setToasts((current) => current.map((item) => (item.id === id ? { ...item, open: false } : item)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, EXIT_MS);
  }, []);

  const toast = React.useCallback((options: ToastOptions): number => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { ...options, id, open: true }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = React.useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      <Toast.Provider swipeDirection={dir === "rtl" ? "left" : "right"} label={t("notification")}>
        {children}

        {toasts.map((item) => (
          <ToastItem
            key={item.id}
            toast={item}
            onOpenChange={(open) => {
              if (!open) dismiss(item.id);
            }}
          />
        ))}

        <Toast.Viewport
          // `{hotkey}` is substituted by Radix (F8 jumps focus to the stack).
          label={t("notifications", { hotkey: "{hotkey}" })}
          className="pointer-events-none fixed inset-x-0 top-0 z-[100] mx-auto flex w-full max-w-md flex-col gap-2 p-4 outline-none sm:inset-x-auto sm:top-auto sm:bottom-0 sm:end-0 sm:mx-0 sm:max-w-sm" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

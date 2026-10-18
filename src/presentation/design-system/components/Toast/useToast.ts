"use client";

import * as React from "react";

import { ToastContext } from "./ToastContext";

import type { ToastApi } from "./toastTypes";

/**
 * Show transient feedback after a mutation:
 *
 *   const { toast } = useToast();
 *   toast({ tone: "success", title: t("saved") });
 *
 * Use it for the *outcome of an action* — a save, a delete, a status change.
 * Field validation stays inline under the field (`<FormMessage>`), where the
 * user has to fix it; a toast that disappears is the wrong place for that.
 */
export function useToast(): ToastApi {
  const api = React.useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <Toaster>.");
  return api;
}

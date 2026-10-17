"use client";

import * as React from "react";

import type { ToastApi } from "./toastTypes";

/** Published by `<Toaster>`; read through `useToast()`. */
export const ToastContext = React.createContext<ToastApi | null>(null);

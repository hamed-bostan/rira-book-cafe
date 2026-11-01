"use client";

import * as React from "react";

import { useDashboardCrumb } from "./DashboardCrumbProvider";

/** Names a full page in the breadcrumb, under its section, for as long as the page is open. */
export function DashboardPageCrumb({ label }: { label: string }): null {
  const { setCrumb } = useDashboardCrumb();

  React.useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);

  return null;
}

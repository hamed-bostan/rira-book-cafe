"use client";

import * as React from "react";

type DashboardCrumbContextValue = {
  crumb: string | null;
  setCrumb: (crumb: string | null) => void;
};

const DashboardCrumbContext = React.createContext<DashboardCrumbContextValue>({ crumb: null, setCrumb: () => {} });

/** Reads what the page below a section has named itself for the breadcrumb. */
export function useDashboardCrumb(): DashboardCrumbContextValue {
  return React.useContext(DashboardCrumbContext);
}

/**
 * Carries a page's own name up to the breadcrumb in the shell. The top bar sits
 * above the page in the tree and can't read its data: the path says `/orders/<id>`,
 * and the crumb says `#229`.
 */
export function DashboardCrumbProvider({ children }: { children: React.ReactNode }) {
  const [crumb, setCrumb] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ crumb, setCrumb }), [crumb]);

  return <DashboardCrumbContext.Provider value={value}>{children}</DashboardCrumbContext.Provider>;
}

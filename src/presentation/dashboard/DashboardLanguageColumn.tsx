import * as React from "react";

import { OVERLINE } from "./fieldStyles";

type DashboardLanguageColumnProps = {
  label: string;
  children: React.ReactNode;
};

/**
 * One language's copy on a full-page form, side by side with the other from `md`
 * (the parent's grid). Both stay on screen, so no value or field error can hide
 * behind a tab.
 */
export function DashboardLanguageColumn({ label, children }: DashboardLanguageColumnProps) {
  const id = React.useId();

  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <p id={id} className={OVERLINE}>
        {label}
      </p>
      {children}
    </div>
  );
}

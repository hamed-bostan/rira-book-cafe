import type { ReactNode } from "react";

/** Public pages share a mobile-first column. The storefront shell (header, nav) slots in here later. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-md">{children}</main>;
}

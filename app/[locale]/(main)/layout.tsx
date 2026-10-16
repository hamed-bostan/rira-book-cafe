import { auth } from "@/auth";
import { BasketProvider } from "@/src/presentation/storefront/basket/BasketProvider";
import { PublicBottomNav } from "@/src/presentation/storefront/layout/PublicBottomNav";
import { PublicHeader } from "@/src/presentation/storefront/layout/PublicHeader";

import type { ReactNode } from "react";

/**
 * The public site's shell: header, page column, and the phone bottom bar. The
 * basket lives here so it follows the guest from the menu to checkout. Bottom
 * padding clears the fixed bar on phones.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <BasketProvider>
      <PublicHeader signedIn={Boolean(session?.user)} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
      <PublicBottomNav />
    </BasketProvider>
  );
}

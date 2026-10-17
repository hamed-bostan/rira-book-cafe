import { auth } from "@/auth";
import { BasketProvider } from "@/src/presentation/storefront/basket/BasketProvider";
import { PublicBottomNav } from "@/src/presentation/storefront/layout/PublicBottomNav";
import { PublicHeader } from "@/src/presentation/storefront/layout/PublicHeader";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { ReactNode } from "react";

/**
 * The public site's shell: header, page column, and the phone bottom bar. The
 * basket lives here so it follows the guest from the menu to checkout. Bottom
 * padding clears the fixed bar on phones.
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const signedIn = Boolean(session?.user);
  // The bell's badge is a nicety: if it can't be read, the page still renders.
  const unreadNotifications = signedIn ? await storefrontServerApi.unreadNotificationCount().catch(() => 0) : 0;

  return (
    <BasketProvider>
      <PublicHeader signedIn={signedIn} unreadNotifications={unreadNotifications} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:pb-12">{children}</main>
      <PublicBottomNav unreadNotifications={unreadNotifications} />
    </BasketProvider>
  );
}

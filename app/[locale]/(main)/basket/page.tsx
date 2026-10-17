import { getTranslations } from "next-intl/server";

import { auth } from "@/auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { BasketScreen } from "@/src/presentation/storefront/basket/BasketScreen";

import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("basket.heading"));
}

/** The basket lives in the browser; the page only needs to know whether the guest can order yet. */
export default async function BasketPage() {
  const session = await auth();
  return <BasketScreen signedIn={Boolean(session?.user)} />;
}

import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { MyBookLoansScreen } from "@/src/presentation/storefront/loans/MyBookLoansScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("loans.heading"));
}

export default async function MyBookLoansPage() {
  await requireAuth();
  const [loans, waitlist] = await Promise.all([storefrontServerApi.myBookLoans(), storefrontServerApi.myBookWaitlist()]);
  return <MyBookLoansScreen loans={loans} waitlist={waitlist} now={new Date().toISOString()} />;
}

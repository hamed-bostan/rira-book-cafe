import { requireAuth } from "@/src/lib/require-auth";
import { MyBookLoansScreen } from "@/src/presentation/storefront/loans/MyBookLoansScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

export default async function MyBookLoansPage() {
  await requireAuth();
  const [loans, waitlist] = await Promise.all([storefrontServerApi.myBookLoans(), storefrontServerApi.myBookWaitlist()]);
  return <MyBookLoansScreen loans={loans} waitlist={waitlist} now={new Date().toISOString()} />;
}

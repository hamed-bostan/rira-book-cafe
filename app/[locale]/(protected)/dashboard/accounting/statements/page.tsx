import { requirePermission } from "@/src/lib/require-permission";
import { StatementsScreen } from "@/src/presentation/dashboard/accounting/StatementsScreen";

export default async function StatementsPage() {
  await requirePermission("accounting.view");
  return <StatementsScreen />;
}

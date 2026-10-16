import { requirePermission } from "@/src/lib/require-permission";
import { ReportsScreen } from "@/src/presentation/dashboard/reports/ReportsScreen";

export default async function DashboardReportsPage() {
  await requirePermission("reports.view");
  return <ReportsScreen />;
}

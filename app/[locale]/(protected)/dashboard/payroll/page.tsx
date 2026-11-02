import { requirePermission } from "@/src/lib/require-permission";
import { payRunsServerApi } from "@/src/presentation/dashboard/payroll/payroll-server-api";
import { PayrollScreen } from "@/src/presentation/dashboard/payroll/PayrollScreen";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  await requirePermission("payroll.manage");
  return <PayrollScreen runs={await payRunsServerApi.list()} />;
}

import { requirePermission } from "@/src/lib/require-permission";
import { EmployeesScreen } from "@/src/presentation/dashboard/payroll/EmployeesScreen";
import { employeesServerApi } from "@/src/presentation/dashboard/payroll/payroll-server-api";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requirePermission("payroll.manage");
  return <EmployeesScreen employees={await employeesServerApi.list(true)} />;
}

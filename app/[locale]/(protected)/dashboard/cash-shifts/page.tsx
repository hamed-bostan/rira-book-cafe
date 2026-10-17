import { requirePermission } from "@/src/lib/require-permission";
import { cashShiftsServerApi } from "@/src/presentation/dashboard/cash-shifts/cash-shift-server-api";
import { CashShiftsScreen } from "@/src/presentation/dashboard/cash-shifts/CashShiftsScreen";

// The till's shifts, fetched over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

export default async function DashboardCashShiftsPage() {
  await requirePermission("shifts.manage");
  const overview = await cashShiftsServerApi.overview();
  return <CashShiftsScreen overview={overview} />;
}

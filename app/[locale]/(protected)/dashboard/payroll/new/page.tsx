import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { NewPayRunScreen } from "@/src/presentation/dashboard/payroll/NewPayRunScreen";
import { payRunsServerApi } from "@/src/presentation/dashboard/payroll/payroll-server-api";

export const dynamic = "force-dynamic";

export default async function NewPayRunPage() {
  await requirePermission("payroll.manage");
  return <NewPayRunScreen draft={await payRunsServerApi.getDraft()} today={cafeDayOf(new Date())} />;
}

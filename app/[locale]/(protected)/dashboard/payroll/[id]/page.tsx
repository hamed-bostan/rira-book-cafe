import { notFound } from "next/navigation";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission } from "@/src/lib/require-permission";
import { payRunsServerApi } from "@/src/presentation/dashboard/payroll/payroll-server-api";
import { PayRunScreen } from "@/src/presentation/dashboard/payroll/PayRunScreen";

export const dynamic = "force-dynamic";

type PayRunPageProps = { params: Promise<{ id: string }> };

export default async function PayRunPage({ params }: PayRunPageProps) {
  await requirePermission("payroll.manage");
  const { id } = await params;
  const detail = await payRunsServerApi.getById(id);
  if (!detail) notFound();

  return <PayRunScreen {...detail} today={cafeDayOf(new Date())} />;
}

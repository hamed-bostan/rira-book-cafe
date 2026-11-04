import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { payRunsServerApi } from "@/src/presentation/dashboard/payroll/payroll-server-api";
import { PayRunScreen } from "@/src/presentation/dashboard/payroll/PayRunScreen";

export const dynamic = "force-dynamic";

type PayRunPageProps = { params: Promise<{ id: string }> };

export default async function PayRunPage({ params }: PayRunPageProps) {
  await requirePermission("payroll.manage");
  const { id } = await params;
  const [detail, session] = await Promise.all([payRunsServerApi.getById(id), auth()]);
  if (!detail) notFound();

  // Payroll is its own permission: a role may run pay without the books, so the
  // entries link into them only for whoever can open them.
  const [view, write] = await Promise.all([
    sessionHas(session, "accounting.view"),
    sessionHas(session, "accounting.write"),
  ]);

  return <PayRunScreen {...detail} today={cafeDayOf(new Date())} books={{ view, write }} />;
}

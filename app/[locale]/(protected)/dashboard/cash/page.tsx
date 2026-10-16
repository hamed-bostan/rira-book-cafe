import { auth } from "@/auth";
import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { parsePageRequest } from "@/src/lib/api/pagination-params";
import { toSearchParams } from "@/src/lib/api/searchParams";
import { requirePermission, sessionHas } from "@/src/lib/require-permission";
import { cashClosesServerApi } from "@/src/presentation/dashboard/cash/cash-close-server-api";
import { CashRegisterScreen } from "@/src/presentation/dashboard/cash/CashRegisterScreen";

// The cash register is read over the REST API (BFF) during server render.
export const dynamic = "force-dynamic";

type CashPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CashPage({ searchParams }: CashPageProps) {
  await requirePermission("cash.close");
  const params = toSearchParams(await searchParams);
  const [status, canViewBooks] = await Promise.all([cashClosesServerApi.getStatus(), auth().then((session) => sessionHas(session, "accounting.view"))]);

  // Days close in order, so the default is the oldest one still waiting, else today.
  const requested = params.get("day") ?? "";
  const day = isCafeDay(requested) && requested <= status.today ? requested : (status.unclosedDays[0] ?? status.today);
  const { page, pageSize } = parsePageRequest(params, []);

  const [closes, figures] = await Promise.all([
    cashClosesServerApi.list({ page: String(page), pageSize: String(pageSize) }),
    canViewBooks ? cashClosesServerApi.getDay(day) : Promise.resolve(null),
  ]);

  return <CashRegisterScreen day={day} status={status} closes={closes} figures={figures} canViewBooks={canViewBooks} />;
}

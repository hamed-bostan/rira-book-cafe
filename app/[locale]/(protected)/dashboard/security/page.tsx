import { requirePermission } from "@/src/lib/require-permission";
import { securityServerApi } from "@/src/presentation/dashboard/security/security-server-api";
import { SecurityScreen } from "@/src/presentation/dashboard/security/SecurityScreen";

// Sessions and two-factor are read per request — a signed-out browser must vanish on the next look.
export const dynamic = "force-dynamic";

/**
 * `/dashboard/security` — your own sign-in security, for every dashboard user:
 * the authenticator app and where you're signed in. Reached from the account menu.
 */
export default async function DashboardSecurityPage() {
  await requirePermission("dashboard.view");
  const [sessions, twoFactor] = await Promise.all([securityServerApi.listSessions(), securityServerApi.getTwoFactor()]);
  return <SecurityScreen sessions={sessions} twoFactor={twoFactor} />;
}

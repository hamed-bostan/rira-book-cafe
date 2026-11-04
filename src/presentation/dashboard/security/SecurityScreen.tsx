import { useTranslations } from "next-intl";

import type { SessionWire, TwoFactorOverviewWire } from "@/src/presentation/dashboard/team/security-response-schema";

import { SessionList } from "./SessionList";
import { TwoFactorPanel } from "./TwoFactorPanel";

type SecurityScreenProps = {
  sessions: SessionWire[];
  twoFactor: TwoFactorOverviewWire;
};

/**
 * Your own sign-in security, for every dashboard user: the authenticator app, and
 * where you're signed in. Presentational — the page reads both over the BFF.
 */
export function SecurityScreen({ sessions, twoFactor }: SecurityScreenProps) {
  const t = useTranslations("dashSecurity");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("summary")}</p>
      </div>
      <TwoFactorPanel overview={twoFactor} />
      <SessionList sessions={sessions} owner={{ kind: "self" }} />
    </div>
  );
}

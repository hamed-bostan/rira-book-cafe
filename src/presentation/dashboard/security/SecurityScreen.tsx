import { useTranslations } from "next-intl";

import type { SessionWire } from "@/src/presentation/dashboard/team/security-response-schema";

import { SessionList } from "./SessionList";

type SecurityScreenProps = {
  sessions: SessionWire[];
};

/**
 * Your own sign-in security, for every dashboard user: where you're signed in.
 * Presentational — the page reads the sessions over the BFF.
 */
export function SecurityScreen({ sessions }: SecurityScreenProps) {
  const t = useTranslations("dashSecurity");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("summary")}</p>
      </div>
      <SessionList sessions={sessions} owner={{ kind: "self" }} />
    </div>
  );
}

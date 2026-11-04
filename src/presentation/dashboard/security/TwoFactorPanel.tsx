"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { ROW_CAPTION } from "@/src/presentation/dashboard/pageStyles";
import type { TwoFactorOverviewWire } from "@/src/presentation/dashboard/team/security-response-schema";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { DisableTwoFactorDialog } from "./DisableTwoFactorDialog";
import { TwoFactorSetup } from "./TwoFactorSetup";

type TwoFactorPanelProps = {
  overview: TwoFactorOverviewWire;
};

/**
 * Your authenticator-app two-factor: whether it's on and since when, how many
 * recovery codes are left, and the way to set it up or turn it off. When the
 * server has no encryption key it says so instead of offering anything.
 */
export function TwoFactorPanel({ overview }: TwoFactorPanelProps) {
  const t = useTranslations("dashSecurity");
  const locale = useLocale();
  const router = useRouter();
  const [disabling, setDisabling] = React.useState(false);
  const [opened, setOpened] = React.useState(0);
  const on = overview.state === "on";

  return (
    <DashboardSection
      title={t("twoFactor.heading")}
      description={t("twoFactor.description")}
      aside={
        <Badge variant={on ? "success" : "neutral"} appearance="outline" size="compact" dot>
          {on ? t("twoFactor.stateOn") : t("twoFactor.stateOff")}
        </Badge>
      }
    >
      {on ? (
        <div className="flex flex-col gap-3">
          <p className={ROW_CAPTION}>
            {overview.enabledAt ? t("twoFactor.onSince", { date: formatOrderDate(overview.enabledAt, locale) }) : null}{" "}
            {t("twoFactor.codesLeft", { count: overview.recoveryCodesLeft })}
          </p>
          {overview.required && overview.available ? (
            <p className={ROW_CAPTION}>{t("twoFactor.requiredNote")}</p>
          ) : (
            <Button
              size="control-md"
              variant="secondary"
              className="self-start px-3"
              onClick={() => {
                setOpened((count) => count + 1);
                setDisabling(true);
              }}
            >
              {t("twoFactor.turnOff")}
            </Button>
          )}
          <DisableTwoFactorDialog key={opened} open={disabling} onOpenChange={setDisabling} />
        </div>
      ) : !overview.available ? (
        <p className={ROW_CAPTION}>{t("twoFactor.unavailable")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-body-default text-pretty text-foreground sm:text-body-small">
            {overview.required ? t("twoFactor.requiredIntro") : t("twoFactor.offIntro")}
          </p>
          <TwoFactorSetup onDone={() => router.refresh()} doneLabel={t("twoFactor.done")} />
        </div>
      )}
    </DashboardSection>
  );
}

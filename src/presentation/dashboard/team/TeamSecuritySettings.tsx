"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import type { TeamSettingsInput } from "@/src/contracts/team-security-schema";
import { ACTIVITY_RETENTION_MONTHS } from "@/src/domain/entities/TeamSettings";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { teamSettingsApi } from "./team-api";

import type { TeamSettingsWire } from "./security-response-schema";

type TeamSecuritySettingsProps = {
  settings: TeamSettingsWire;
};

/** The select's value for "keep forever". */
const FOREVER = "forever";

/**
 * The owner's team-wide settings, each saved as it's changed: require two-factor
 * for every dashboard user, and how long the activity log keeps entries. Both are
 * recorded in the log. Requiring two-factor waits until the server can do it (an
 * encryption key is configured) — and says so rather than offering a switch that
 * would lock everyone out.
 */
export function TeamSecuritySettings({ settings }: TeamSecuritySettingsProps) {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(values: TeamSettingsInput): void {
    setError(null);
    startTransition(async () => {
      try {
        await teamSettingsApi.update(values);
        toast({ tone: "success", title: t("securitySettings.saved") });
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("securitySettings.error")));
      }
      router.refresh();
    });
  }

  const months = (count: number): string =>
    count % 12 === 0 ? t("securitySettings.years", { count: count / 12 }) : t("securitySettings.months", { count });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardSection
        title={t("securitySettings.twoFactorHeading")}
        description={t("securitySettings.twoFactorDescription")}
      >
        <DashboardSwitchField
          label={t("securitySettings.requireTwoFactor")}
          hint={
            settings.twoFactorAvailable
              ? t("securitySettings.requireTwoFactorHint")
              : t("securitySettings.twoFactorUnavailable")
          }
          checked={settings.requireTwoFactor}
          disabled={pending || (!settings.twoFactorAvailable && !settings.requireTwoFactor)}
          onCheckedChange={(requireTwoFactor) => save({ requireTwoFactor })}
        />
      </DashboardSection>

      <DashboardSection
        title={t("securitySettings.retentionHeading")}
        description={t("securitySettings.retentionDescription")}
      >
        <DashboardField
          label={t("securitySettings.retentionLabel")}
          hint={t("securitySettings.retentionHint")}
          className="max-w-sm"
        >
          <Select
            size="control-md"
            disabled={pending}
            value={settings.activityRetentionMonths === null ? FOREVER : String(settings.activityRetentionMonths)}
            onChange={(event) =>
              save({
                activityRetentionMonths: event.target.value === FOREVER ? null : Number(event.target.value),
              })
            }
          >
            <option value={FOREVER}>{t("securitySettings.forever")}</option>
            {ACTIVITY_RETENTION_MONTHS.map((count) => (
              <option key={count} value={count}>
                {months(count)}
              </option>
            ))}
          </Select>
        </DashboardField>
      </DashboardSection>

      {error ? <FormAlert>{error}</FormAlert> : null}
    </div>
  );
}

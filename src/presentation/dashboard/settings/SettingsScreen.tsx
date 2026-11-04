import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CafeSettings } from "@/src/domain/entities/CafeSettings";
import type { CafeTable } from "@/src/domain/entities/CafeTable";
import { CAFE_TIME_ZONE } from "@/src/domain/entities/CafeTime";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { FIELD_HINT } from "../fieldStyles";

import { CafeProfileForm } from "./CafeProfileForm";
import { CafeTablesSection } from "./CafeTablesSection";
import { OpeningHoursForm } from "./OpeningHoursForm";
import { ReceiptSettingsForm } from "./ReceiptSettingsForm";

type SettingsScreenProps = {
  settings: CafeSettings;
  tables: CafeTable[];
  /** Today on the cafe calendar — where a new special day starts. */
  today: string;
};

/**
 * The cafe's settings, one card per section, each saved on its own: who and where
 * it is, when it's open, its tables, and its receipt. The time zone is shown, not
 * set — everything in the app runs on Tehran time. Presentational: the page reads
 * the settings and tables over the REST API.
 */
export async function SettingsScreen({ settings, tables, today }: SettingsScreenProps) {
  const t = await getTranslations("dashSettings");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="dashboard-page-title">{t("heading")}</h1>
        <p className="text-body-default text-pretty text-muted-foreground sm:text-body-small">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <CafeProfileForm profile={settings.profile} />
          <ReceiptSettingsForm receipt={settings.receipt} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <OpeningHoursForm hours={settings.hours} today={today} />
          <CafeTablesSection tables={tables} />
          <section
            aria-label={t("timeZone.heading")}
            className="flex min-w-0 items-start gap-3 rounded-card-lg border border-border bg-background p-5 shadow-xs"
          >
            <Icon icon={Clock} size="icon-md" className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-body-strong text-foreground">{t("timeZone.heading")}</h2>
              <p className="text-body-default text-foreground sm:text-body-small" dir="ltr">
                {CAFE_TIME_ZONE} (UTC+03:30)
              </p>
              <p className={FIELD_HINT}>{t("timeZone.note")}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

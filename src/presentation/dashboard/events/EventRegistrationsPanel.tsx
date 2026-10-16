import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent, type EventRegistration } from "@/src/domain/entities/CafeEvent";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { DashboardPanel, DashboardPanelHeader } from "@/src/presentation/dashboard/DashboardPanel";
import { Badge } from "@/src/presentation/design-system";

import { CancelRegistrationButton } from "./CancelRegistrationButton";

type EventRegistrationsPanelProps = {
  event: CafeEvent;
  registrations: EventRegistration[];
  canManage: boolean;
};

/** The guest list: who signed up, how many seats, and what's left. */
export async function EventRegistrationsPanel({ event, registrations, canManage }: EventRegistrationsPanelProps) {
  const t = await getTranslations("dashEvents");
  const locale = await getLocale();
  const left = seatsLeft(event);

  return (
    <DashboardPanel>
      <DashboardPanelHeader
        title={t("registrationsHeading")}
        action={
          <span className="text-body-small text-muted-foreground">
            {left === undefined
              ? t("seatsTakenUnlimited", { taken: formatNumber(event.seatsTaken, locale) })
              : t("seatsTaken", {
                  taken: formatNumber(event.seatsTaken, locale),
                  capacity: formatNumber(event.capacity ?? 0, locale),
                })}
          </span>
        }
      />
      {registrations.length === 0 ? (
        <p className="mt-4 text-body-small text-muted-foreground">{t("registrationsEmpty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {registrations.map((registration) => (
            <li key={registration.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-body-small-strong text-foreground">
                  {registration.guestName}
                  {registration.status === "cancelled" ? <Badge variant="neutral">{t("registrationCancelled")}</Badge> : null}
                </p>
                <p className="text-body-caption text-muted-foreground">
                  <span dir="ltr">{registration.guestPhone}</span> ·{" "}
                  {t("seatCount", { count: registration.seats, formatted: formatNumber(registration.seats, locale) })} ·{" "}
                  {formatOrderDateShort(registration.createdAt, locale)}
                </p>
              </div>
              {canManage && registration.status === "registered" ? (
                <CancelRegistrationButton
                  eventId={event.id}
                  registrationId={registration.id}
                  guestName={registration.guestName}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

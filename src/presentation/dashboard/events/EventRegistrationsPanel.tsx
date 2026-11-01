import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent, type EventRegistration } from "@/src/domain/entities/CafeEvent";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { TakePaymentButton } from "@/src/presentation/dashboard/income/TakePaymentButton";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";

import { CancelRegistrationButton } from "./CancelRegistrationButton";

type EventRegistrationsPanelProps = {
  event: CafeEvent;
  registrations: EventRegistration[];
  canManage: boolean;
  /** For a viewer who can take money: today, and the VAT inside prices. */
  payment?: { today: string; vatRateBps: number };
};

/** The guest list: who signed up, how many seats, what they've paid, and what's left. */
export async function EventRegistrationsPanel({
  event,
  registrations,
  canManage,
  payment,
}: EventRegistrationsPanelProps) {
  const t = await getTranslations("dashEvents");
  const locale = await getLocale();
  const left = seatsLeft(event);

  return (
    <DashboardSection
      title={t("registrationsHeading")}
      description={
        left === undefined
          ? t("seatsTakenUnlimited", { taken: formatNumber(event.seatsTaken, locale) })
          : t("seatsTaken", {
              taken: formatNumber(event.seatsTaken, locale),
              capacity: formatNumber(event.capacity ?? 0, locale),
            })
      }
    >
      {registrations.length === 0 ? (
        <p className="text-muted-foreground">{t("registrationsEmpty")}</p>
      ) : (
        <ul className="-my-3 flex flex-col divide-y divide-border">
          {registrations.map((registration) => (
            <li key={registration.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
              <div className="flex min-w-0 flex-col">
                <span className="font-medium text-foreground">{registration.guestName}</span>
                <span className={FIELD_HINT}>
                  <span dir="ltr" className="whitespace-nowrap tabular-nums">
                    {registration.guestPhone}
                  </span>{" "}
                  · <span className="whitespace-nowrap">{formatOrderDateShort(registration.createdAt, locale)}</span>
                </span>
              </div>
              <div className="ms-auto flex flex-none items-center gap-3">
                <span className="whitespace-nowrap text-foreground/80 tabular-nums">
                  {t("seatCount", { count: registration.seats, formatted: formatNumber(registration.seats, locale) })}
                </span>
                {registration.paidAmount ? (
                  <Badge variant="success" appearance="outline" size="compact">
                    {t("registrationPaid", { amount: formatMoney(registration.paidAmount, locale) })}
                  </Badge>
                ) : null}
                {registration.status === "cancelled" ? (
                  <Badge variant="neutral" appearance="outline" size="compact">
                    {t("registrationCancelled")}
                  </Badge>
                ) : null}
                {registration.status === "cancelled" && registration.paidAmount ? (
                  <span className={FIELD_HINT}>{t("registrationRefundDue")}</span>
                ) : null}
                {payment &&
                registration.status === "registered" &&
                event.price * registration.seats > (registration.paidAmount ?? 0) ? (
                  <TakePaymentButton
                    today={payment.today}
                    vatRateBps={payment.vatRateBps}
                    preset={{
                      accountCode: SYSTEM_ACCOUNTS.salesEvents,
                      description: `${event.title} × ${registration.seats}`,
                      amount: event.price * registration.seats - (registration.paidAmount ?? 0),
                      payerName: registration.guestName,
                      sourceType: "eventRegistration",
                      sourceId: registration.id,
                    }}
                  />
                ) : null}
                {canManage && registration.status === "registered" ? (
                  <CancelRegistrationButton
                    eventId={event.id}
                    registrationId={registration.id}
                    guestName={registration.guestName}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

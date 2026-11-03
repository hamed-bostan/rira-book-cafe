import { getLocale, getTranslations } from "next-intl/server";

import { seatsLeft, type CafeEvent, type EventRegistration } from "@/src/domain/entities/CafeEvent";
import { netPaid } from "@/src/domain/entities/IncomeRefund";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDateShort } from "@/src/lib/formatOrderDate";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { RefundButton } from "@/src/presentation/dashboard/income/RefundButton";
import { TakePaymentButton } from "@/src/presentation/dashboard/income/TakePaymentButton";
import type { RefundOffer } from "@/src/presentation/dashboard/income/useRefundOffer";
import { ROW_END } from "@/src/presentation/dashboard/pageStyles";
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
          {registrations.map((registration) => {
            const left = netPaid(registration);
            const due = event.price * registration.seats - left;
            // A viewer who keeps the books can hand back what's been paid.
            const refund: RefundOffer | undefined =
              payment && left > 0
                ? {
                    target: { kind: "eventRegistration", eventId: event.id, registrationId: registration.id },
                    guestName: registration.guestName,
                    left,
                  }
                : undefined;
            return (
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
                <div className={ROW_END}>
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
                  {registration.refundedAmount ? (
                    <Badge variant="neutral" appearance="outline" size="compact">
                      {t("registrationRefunded", { amount: formatMoney(registration.refundedAmount, locale) })}
                    </Badge>
                  ) : null}
                  {registration.status === "cancelled" && left > 0 && !refund ? (
                    <span className={FIELD_HINT}>{t("registrationRefundDue")}</span>
                  ) : null}
                  {payment && registration.status === "registered" && due > 0 ? (
                    <TakePaymentButton
                      today={payment.today}
                      vatRateBps={payment.vatRateBps}
                      preset={{
                        accountCode: SYSTEM_ACCOUNTS.salesEvents,
                        description: `${event.title} × ${registration.seats}`,
                        amount: due,
                        payerName: registration.guestName,
                        sourceType: "eventRegistration",
                        sourceId: registration.id,
                      }}
                    />
                  ) : null}
                  {refund ? (
                    <RefundButton
                      target={refund.target}
                      guestName={registration.guestName}
                      paid={registration.paidAmount ?? 0}
                      refunded={registration.refundedAmount ?? 0}
                      // A cancelled sign-up is owed all of it back; a live one, only what it overpaid.
                      suggested={registration.status === "cancelled" ? left : due < 0 ? -due : undefined}
                    />
                  ) : null}
                  {canManage && registration.status === "registered" ? (
                    <CancelRegistrationButton
                      eventId={event.id}
                      registrationId={registration.id}
                      guestName={registration.guestName}
                      refund={refund}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}

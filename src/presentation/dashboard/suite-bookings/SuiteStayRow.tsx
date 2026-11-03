import { CircleAlert, MessageSquare, Phone, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { netPaid } from "@/src/domain/entities/IncomeRefund";
import { SYSTEM_ACCOUNTS } from "@/src/domain/entities/Ledger";
import { suiteNights, type SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { suiteStayMoney } from "@/src/domain/entities/SuitePricing";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { MessageGuestButton } from "@/src/presentation/dashboard/guest-messages/MessageGuestButton";
import { RefundButton } from "@/src/presentation/dashboard/income/RefundButton";
import { TakePaymentButton } from "@/src/presentation/dashboard/income/TakePaymentButton";
import type { RefundOffer } from "@/src/presentation/dashboard/income/useRefundOffer";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { SuiteBookingStatusBadge } from "./SuiteBookingStatusBadge";
import { SuiteStayActions } from "./SuiteStayActions";
import { SuiteStayMoney } from "./SuiteStayMoney";

type SuiteStayRowProps = {
  booking: SuiteBooking;
  /** The held stay this request overlaps, if any — it can't be confirmed as asked. */
  clash: SuiteBooking | undefined;
  /** Stays holding the suite, so "Edit stay" can warn before moving onto their nights. */
  held: readonly Pick<SuiteBooking, "id" | "reference" | "checkIn" | "checkOut">[];
  today: string;
  /** Picked from the calendar: tinted so the eye lands on it. */
  focused: boolean;
  canManage: boolean;
  /** For a viewer who can take money: the VAT inside prices. */
  payment?: { vatRateBps: number };
};

const FINISHED = ["checkedOut", "cancelled", "noShow"];

/**
 * One stay in the list: its nights and reference, the guest with the stay's
 * status and what's due today (arriving, checking out, overdue), party and phone,
 * any note, a clash with a held stay, and the desk's controls.
 */
export async function SuiteStayRow({ booking, clash, held, today, focused, canManage, payment }: SuiteStayRowProps) {
  const t = await getTranslations("dashSuite");
  const locale = await getLocale();

  const range = (stay: Pick<SuiteBooking, "checkIn" | "checkOut">): string =>
    `${formatCafeDayShort(stay.checkIn, locale)} → ${formatCafeDayShort(stay.checkOut, locale)}`;
  const nights = suiteNights(booking.checkIn, booking.checkOut);
  // What's left to pay (nights × rate, less what's been paid and not handed back).
  const { balance } = suiteStayMoney(booking);
  const left = netPaid(booking);
  // A viewer who keeps the books can hand back what's been paid.
  const refund: RefundOffer | undefined =
    payment && left > 0
      ? { target: { kind: "suiteBooking", stayId: booking.id }, guestName: booking.guestName, left }
      : undefined;
  const hint =
    booking.status === "checkedIn" && booking.checkOut === today
      ? { text: t("checksOutToday"), tone: "text-warning-foreground" }
      : booking.status === "confirmed" && booking.checkIn === today
        ? { text: t("arrivesToday"), tone: "text-accent-foreground" }
        : booking.status === "confirmed" && booking.checkIn < today
          ? { text: t("wasDue", { day: formatCafeDayShort(booking.checkIn, locale) }), tone: "text-error-foreground" }
          : null;

  return (
    <article
      id={`stay-${booking.id}`}
      aria-label={`S-${booking.reference}, ${booking.guestName}`}
      className={cn(
        "flex scroll-mt-24 flex-wrap items-start gap-x-5 gap-y-3 px-5 py-4",
        focused && "bg-accent",
        FINISHED.includes(booking.status) && "opacity-70",
      )}
    >
      <div className="flex w-40 shrink-0 flex-col whitespace-nowrap tabular-nums">
        <span className="text-body-lead font-semibold text-foreground lg:text-heading-subsection">
          {range(booking)}
        </span>
        <span className="text-body-small text-muted-foreground sm:text-body-caption">
          {t("nights", { count: nights, formatted: formatNumber(nights, locale) })} · S-{booking.reference}
        </span>
      </div>

      <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-body-strong text-foreground">{booking.guestName}</span>
          <SuiteBookingStatusBadge status={booking.status} expired={booking.expiredAt !== undefined} outlined />
          {hint ? (
            <span className={cn("text-body-small font-semibold whitespace-nowrap sm:text-body-caption", hint.tone)}>
              {hint.text}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-default text-foreground/80 sm:text-body-small">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon icon={Users} size="icon-md" className="text-muted-foreground" />
            {t("guests", { count: booking.guests, formatted: formatNumber(booking.guests, locale) })}
          </span>
          <a
            href={`tel:${booking.guestPhone.replace(/\s/g, "")}`}
            dir="ltr"
            // 44px to the touch on a phone without moving the row.
            className={cn(
              "-my-3 flex items-center gap-1.5 py-3 whitespace-nowrap tabular-nums transition-colors hover:text-primary sm:my-0 sm:py-0",
              focusRing,
            )}
          >
            <Icon icon={Phone} size="icon-md" className="text-muted-foreground" />
            {booking.guestPhone}
          </a>
          {canManage ? (
            <MessageGuestButton
              guest={{ name: booking.guestName, phone: booking.guestPhone }}
              about={{ kind: "suiteBooking", id: booking.id, label: `S-${booking.reference}` }}
            />
          ) : null}
        </div>
        <SuiteStayMoney
          booking={booking}
          nightsLabel={`${t("nights", { count: nights, formatted: formatNumber(nights, locale) })} · ${range(booking)}`}
          canSetRate={payment !== undefined}
        />
        {booking.note ? (
          <p className="flex items-start gap-1.5 text-body-default text-pretty text-muted-foreground sm:text-body-small">
            <Icon icon={MessageSquare} size="icon-md" className="mt-0.5 shrink-0" />“{booking.note}”
          </p>
        ) : null}
        {clash ? (
          <p className="flex items-center gap-1.5 text-body-default font-semibold text-error-foreground sm:text-body-small">
            <Icon icon={CircleAlert} size="icon-md" className="shrink-0" />
            {t("clashesWith", { reference: clash.reference, range: range(clash) })}
          </p>
        ) : null}
      </div>

      {payment &&
      booking.status !== "cancelled" &&
      booking.status !== "noShow" &&
      booking.status !== "requested" &&
      // Nothing left to pay on a priced stay: no button. One with no price yet still takes money.
      (balance === undefined || balance > 0) ? (
        <TakePaymentButton
          today={today}
          vatRateBps={payment.vatRateBps}
          preset={{
            accountCode: SYSTEM_ACCOUNTS.salesSuite,
            description: t("paymentDescription", { reference: booking.reference, range: range(booking) }),
            amount: balance,
            payerName: booking.guestName,
            sourceType: "suiteBooking",
            sourceId: booking.id,
          }}
        />
      ) : null}
      {refund ? (
        <RefundButton
          target={refund.target}
          guestName={booking.guestName}
          paid={booking.paidAmount ?? 0}
          refunded={booking.refundedAmount ?? 0}
          // What's due back: all of it on a stay that ended unstayed, what was overpaid otherwise.
          suggested={
            booking.status === "cancelled" || booking.status === "noShow"
              ? refund.left
              : balance !== undefined && balance < 0
                ? -balance
                : undefined
          }
        />
      ) : null}

      {canManage ? (
        <SuiteStayActions
          booking={booking}
          held={held}
          today={today}
          clashReference={clash?.reference}
          checkInLabel={formatCafeDayShort(booking.checkIn, locale)}
          rangeLabel={range(booking)}
          refund={refund}
        />
      ) : null}
    </article>
  );
}

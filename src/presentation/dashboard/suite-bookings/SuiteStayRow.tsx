import { CircleAlert, MessageSquare, Phone, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { suiteNights, type SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { SuiteBookingStatusBadge } from "./SuiteBookingStatusBadge";
import { SuiteStayActions } from "./SuiteStayActions";

type SuiteStayRowProps = {
  booking: SuiteBooking;
  /** The held stay this request overlaps, if any — it can't be confirmed as asked. */
  clash: SuiteBooking | undefined;
  today: string;
  /** Picked from the calendar: tinted so the eye lands on it. */
  focused: boolean;
  canManage: boolean;
};

const FINISHED = ["checkedOut", "cancelled", "noShow"];

/**
 * One stay in the list: its nights and reference, the guest with the stay's
 * status and what's due today (arriving, checking out, overdue), party and phone,
 * any note, a clash with a held stay, and the desk's controls.
 */
export async function SuiteStayRow({ booking, clash, today, focused, canManage }: SuiteStayRowProps) {
  const t = await getTranslations("dashSuite");
  const locale = await getLocale();

  const range = (stay: Pick<SuiteBooking, "checkIn" | "checkOut">): string =>
    `${formatCafeDayShort(stay.checkIn, locale)} → ${formatCafeDayShort(stay.checkOut, locale)}`;
  const nights = suiteNights(booking.checkIn, booking.checkOut);
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
          <SuiteBookingStatusBadge status={booking.status} outlined />
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
        </div>
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

      {canManage ? (
        <SuiteStayActions
          booking={booking}
          today={today}
          clashReference={clash?.reference}
          checkInLabel={formatCafeDayShort(booking.checkIn, locale)}
          rangeLabel={range(booking)}
        />
      ) : null}
    </article>
  );
}

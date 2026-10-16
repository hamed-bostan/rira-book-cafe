import { StickyNote, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { suiteNights, type SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatNumber } from "@/src/lib/formatNumber";
import { Icon } from "@/src/presentation/design-system";

import { SuiteBookingActions } from "./SuiteBookingActions";
import { SuiteBookingStatusBadge } from "./SuiteBookingStatusBadge";

type SuiteBookingCardProps = {
  booking: SuiteBooking;
  /** Whether to draw the workflow controls. */
  canManage: boolean;
};

/** One stay: dates and nights, guest, party, note, status and controls. */
export async function SuiteBookingCard({ booking, canManage }: SuiteBookingCardProps) {
  const t = await getTranslations("dashSuite");
  const locale = await getLocale();
  const nights = suiteNights(booking.checkIn, booking.checkOut);

  return (
    <li className="flex flex-col gap-3 rounded-card-md border border-border bg-background p-4 @min-[40rem]:flex-row @min-[40rem]:items-start">
      <div className="shrink-0 @min-[40rem]:w-44">
        <p className="text-body-small-strong text-foreground">
          {formatCafeDayMedium(booking.checkIn, locale)} → {formatCafeDayMedium(booking.checkOut, locale)}
        </p>
        <p className="text-body-caption text-muted-foreground">
          S-{booking.reference} · {t("nights", { count: nights, formatted: formatNumber(nights, locale) })}
        </p>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-small-strong text-foreground">{booking.guestName}</span>
          <SuiteBookingStatusBadge status={booking.status} />
        </div>
        <p dir="ltr" className="text-start text-body-small text-muted-foreground">{booking.guestPhone}</p>
        <p className="flex items-center gap-1.5 text-body-small text-foreground">
          <Icon icon={Users} size="xs" className="text-muted-foreground" />
          {t("guests", { count: booking.guests, formatted: formatNumber(booking.guests, locale) })}
        </p>
        {booking.note ? (
          <p className="flex items-start gap-1.5 text-body-small text-warning-foreground">
            <Icon icon={StickyNote} size="xs" className="mt-0.5 shrink-0" />
            {booking.note}
          </p>
        ) : null}
      </div>

      {canManage ? (
        <div className="shrink-0">
          <SuiteBookingActions booking={booking} />
        </div>
      ) : null}
    </li>
  );
}

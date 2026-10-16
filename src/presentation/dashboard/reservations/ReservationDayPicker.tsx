"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { Button, Icon, Input } from "@/src/presentation/design-system";

type ReservationDayPickerProps = {
  /** The day on screen, `YYYY-MM-DD` on the cafe calendar. */
  day: string;
  /** Today on the cafe calendar, for the "Today" shortcut. */
  today: string;
  /** The rest of the query string (e.g. the status filter), kept when the day changes. */
  query: string;
};

/** Previous / today / next, plus a date field — each just changes `?day=` and re-renders. */
export function ReservationDayPicker({ day, today, query }: ReservationDayPickerProps) {
  const t = useTranslations("dashReservations");
  const router = useRouter();

  function go(next: string): void {
    const params = new URLSearchParams(query);
    if (next === today) params.delete("day");
    else params.set("day", next);
    const qs = params.toString();
    router.push(qs ? `/dashboard/reservations?${qs}` : "/dashboard/reservations");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" iconOnly aria-label={t("previousDay")} onClick={() => go(shiftCafeDay(day, -1))}>
        <Icon icon={ChevronLeft} size="sm" className="rtl:-scale-x-100" />
      </Button>
      <Button type="button" variant={day === today ? "primary" : "outline"} size="sm" onClick={() => go(today)}>
        {t("today")}
      </Button>
      <Button type="button" variant="outline" size="sm" iconOnly aria-label={t("nextDay")} onClick={() => go(shiftCafeDay(day, 1))}>
        <Icon icon={ChevronRight} size="sm" className="rtl:-scale-x-100" />
      </Button>
      <Input
        type="date"
        aria-label={t("pickDay")}
        value={day}
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
        className="h-9 w-auto"
        dir="ltr"
      />
    </div>
  );
}

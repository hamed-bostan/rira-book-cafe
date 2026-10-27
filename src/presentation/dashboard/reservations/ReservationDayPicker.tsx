"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type ReservationDayPickerProps = {
  /** The day on screen, `YYYY-MM-DD` on the cafe calendar. */
  day: string;
  /** Today on the cafe calendar, for the "Today" shortcut. */
  today: string;
};

const SEGMENT = cn(
  "flex h-11 items-center justify-center text-foreground/80 transition-colors hover:bg-muted sm:h-9",
  focusRing,
);

/**
 * Previous / today / next as one segmented control, plus a date field. Each just
 * changes `?day=`; a new day starts on the "All" tab.
 */
export function ReservationDayPicker({ day, today }: ReservationDayPickerProps) {
  const t = useTranslations("dashReservations");
  const router = useRouter();

  function go(next: string): void {
    router.push(next === today ? "/dashboard/reservations" : `/dashboard/reservations?day=${next}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center rounded-button border border-border bg-background">
        <button
          type="button"
          aria-label={t("previousDay")}
          onClick={() => go(shiftCafeDay(day, -1))}
          className={cn(SEGMENT, "w-11 rounded-s-button sm:w-9")}
        >
          <Icon icon={ChevronLeft} size="sm" className="rtl:-scale-x-100" />
        </button>
        <button
          type="button"
          aria-current={day === today ? "date" : undefined}
          onClick={() => go(today)}
          className={cn(
            SEGMENT,
            "border-x border-border px-3 text-body-default font-medium sm:text-body-small",
            day === today && "text-muted-foreground",
          )}
        >
          {t("today")}
        </button>
        <button
          type="button"
          aria-label={t("nextDay")}
          onClick={() => go(shiftCafeDay(day, 1))}
          className={cn(SEGMENT, "w-11 rounded-e-button sm:w-9")}
        >
          <Icon icon={ChevronRight} size="sm" className="rtl:-scale-x-100" />
        </button>
      </div>
      <Input
        size="control-md"
        type="date"
        aria-label={t("pickDay")}
        value={day}
        onChange={(event) => {
          if (event.target.value) go(event.target.value);
        }}
        className="w-auto tabular-nums"
        dir="ltr"
      />
    </div>
  );
}

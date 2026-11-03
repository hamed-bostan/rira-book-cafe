import { Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { holdPickupState, type HoldPickupState } from "@/src/domain/entities/BookWaitlist";
import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { formatCafeDayShort } from "@/src/lib/formatCafeDay";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** Calm while there's time, amber on the last two days, red once it's gone. */
const TONE: Record<HoldPickupState, string> = {
  open: "text-foreground/80",
  closing: "font-semibold text-warning-foreground",
  passed: "font-semibold text-error-foreground",
};

type HoldPickupDeadlineProps = {
  /** ISO 8601: the last instant the told guest can collect the book. */
  pickupBy: string;
  now: Date;
};

/**
 * The day a told guest must collect their book by — "Collect by Thu 6 Nov" —
 * coloured by how close it is. Once it's gone (the jobs skip them within minutes)
 * it says they didn't.
 */
export async function HoldPickupDeadline({ pickupBy, now }: HoldPickupDeadlineProps) {
  const t = await getTranslations("dashBookHolds");
  const locale = await getLocale();
  const state = holdPickupState(pickupBy, now);
  const date = formatCafeDayShort(cafeDayOf(new Date(pickupBy)), locale);

  return (
    <span className={cn("flex items-center gap-1.5 text-body-small tabular-nums sm:text-body-caption", TONE[state])}>
      <Icon icon={Clock} size="icon-md" className="shrink-0" />
      {state === "passed" ? t("collectByPassed", { date }) : t("collectBy", { date })}
    </span>
  );
}

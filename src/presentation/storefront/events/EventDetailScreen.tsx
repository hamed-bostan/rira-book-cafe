import { CalendarDays, ChevronLeft, Clock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { isOpenForRegistration, seatsLeft, type CafeEvent, type EventRegistration } from "@/src/domain/entities/CafeEvent";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate, formatOrderTime } from "@/src/lib/formatOrderDate";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Badge, Icon } from "@/src/presentation/design-system";

import { eventDescription, eventTitle } from "../eventCopy";

import { EventSignUp } from "./EventSignUp";

type EventDetailScreenProps = {
  event: CafeEvent;
  signedIn: boolean;
  registration?: EventRegistration;
  now: string;
};

/** One event: what, when, price, seats, and signing up. */
export async function EventDetailScreen({ event, signedIn, registration, now }: EventDetailScreenProps) {
  const t = await getTranslations("site");
  const tEvents = await getTranslations("dashEvents");
  const locale = await getLocale();
  const left = seatsLeft(event);
  const description = eventDescription(event, locale);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/events" className="inline-flex w-fit items-center gap-1 text-body-small-strong text-muted-foreground hover:text-foreground">
        <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
        {t("events.back")}
      </Link>

      {event.imageUrl ? (
        <div className="relative aspect-[16/9] overflow-hidden rounded-card-lg bg-muted">
          <FadeInImage src={event.imageUrl} alt="" fill sizes="(min-width: 768px) 768px, 100vw" className="object-cover" priority />
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Badge variant="primary" className="self-start">{tEvents(`kind.${event.kind}`)}</Badge>
        <h1 className="text-heading-page text-foreground">{eventTitle(event, locale)}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-body-small text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Icon icon={CalendarDays} size="xs" />
            {formatOrderDate(event.startsAt, locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <Icon icon={Clock} size="xs" />
            {formatOrderTime(event.startsAt, locale)} – {formatOrderTime(event.endsAt, locale)}
          </span>
        </div>
        <p className="text-body-default text-foreground">
          {event.price === 0 ? t("events.free") : t("events.perSeat", { price: formatMoney(event.price, locale) })}
          {left !== undefined ? ` · ${t("events.seatsLeft", { count: left, formatted: formatNumber(left, locale) })}` : null}
        </p>
      </div>

      <EventSignUp
        eventId={event.id}
        open={isOpenForRegistration(event, new Date(now))}
        seatsLeft={left}
        signedIn={signedIn}
        registration={registration}
      />

      {description ? <p className="whitespace-pre-wrap text-body-default text-muted-foreground">{description}</p> : null}
    </div>
  );
}

import { BookOpen, CalendarClock, CalendarDays, Coffee } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CafeEvent } from "@/src/domain/entities/CafeEvent";
import type { Product } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { EventCard } from "../events/EventCard";
import { MenuItemCard } from "../menu/MenuItemCard";

type HomeScreenProps = {
  featured: Product[];
  events: CafeEvent[];
};

/** The front door: what the cafe is, today's highlights, what's on, and a way to book. */
export async function HomeScreen({ featured, events }: HomeScreenProps) {
  const t = await getTranslations("site");

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-start gap-4 rounded-card-lg bg-accent px-6 py-10 md:px-10 md:py-14">
        <h1 className="max-w-2xl text-heading-page text-foreground">{t("home.title")}</h1>
        <p className="max-w-xl text-body-default text-muted-foreground">{t("home.tagline")}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/menu">
              <Icon icon={Coffee} size="sm" className="me-1.5" />
              {t("home.seeMenu")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/book">
              <Icon icon={CalendarClock} size="sm" className="me-1.5" />
              {t("home.bookTable")}
            </Link>
          </Button>
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-heading-subsection text-foreground">{t("home.featured")}</h2>
            <Link href="/menu" className="text-body-small-emphasis text-primary underline-offset-4 hover:underline">
              {t("home.fullMenu")}
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {featured.slice(0, 8).map((item) => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-heading-subsection text-foreground">{t("home.whatsOn")}</h2>
          <Link href="/events" className="text-body-small-emphasis text-primary underline-offset-4 hover:underline">
            {t("home.allEvents")}
          </Link>
        </div>
        {events.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {events.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title={t("events.none")}
            className="rounded-card-lg border border-dashed border-border py-10"
          />
        )}
      </section>

      <section className="flex flex-col items-start gap-3 rounded-card-lg border border-border px-6 py-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-primary">
            <Icon icon={BookOpen} size="md" />
          </span>
          <div>
            <p className="text-body-strong text-foreground">{t("home.booksTitle")}</p>
            <p className="text-body-small text-muted-foreground">{t("home.booksBody")}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href="/menu?kind=book">{t("home.browseBooks")}</Link>
        </Button>
      </section>
    </div>
  );
}

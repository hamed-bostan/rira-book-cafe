import {
  BedDouble,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Gift,
  LayoutDashboard,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { ProfileWire } from "@/src/contracts/profile-schema";
import type { CafeEvent, EventRegistration } from "@/src/domain/entities/CafeEvent";
import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { formatOrderDate } from "@/src/lib/formatOrderDate";
import { cn } from "@/src/lib/utils";
import { LocaleToggle } from "@/src/presentation/components/LocaleToggle";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { eventTitle } from "../eventCopy";

import { ProfileForm } from "./ProfileForm";
import { SignOutButton } from "./SignOutButton";

import type { LucideIcon } from "lucide-react";

type AccountScreenProps = {
  profile: ProfileWire;
  /** Active sign-ups whose event is still listed, each with its event. */
  signUps: { registration: EventRegistration; event: CafeEvent }[];
  /** Whether to offer a link to the staff dashboard. */
  canOpenDashboard: boolean;
  /** Unread notifications, counted beside the inbox link. */
  unreadNotifications: number;
  /** Loyalty points, shown beside the rewards link. */
  pointsBalance: number;
};

/** The guest's account: profile, shortcuts to their orders and bookings, their event sign-ups, language and sign out. */
export async function AccountScreen({
  profile,
  signUps,
  canOpenDashboard,
  unreadNotifications,
  pointsBalance,
}: AccountScreenProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();

  const links: { href: string; label: string; icon: LucideIcon; count?: number; detail?: string }[] = [
    { href: "/notifications", label: t("account.notifications"), icon: Bell, count: unreadNotifications },
    {
      href: "/rewards",
      label: t("account.rewards"),
      icon: Gift,
      detail: t("account.pointsBalance", { points: formatNumber(pointsBalance, locale) }),
    },
    { href: "/orders", label: t("account.myOrders"), icon: ClipboardList },
    { href: "/reservations", label: t("account.myReservations"), icon: CalendarClock },
    { href: "/suite", label: t("account.mySuiteStays"), icon: BedDouble },
    { href: "/loans", label: t("account.myBookLoans"), icon: BookOpen },
    ...(canOpenDashboard ? [{ href: "/dashboard", label: t("account.dashboard"), icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-heading-page text-foreground">{t("account.heading")}</h1>

      <ProfileForm profile={profile} />

      <nav
        aria-label={t("account.heading")}
        className="flex flex-col divide-y divide-border rounded-card-lg border border-border"
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn("flex items-center gap-3 px-4 py-4 hover:bg-muted", focusRing)}
          >
            <Icon icon={link.icon} size="sm" className="text-primary" />
            <span className="flex-1 text-body-small-strong text-foreground">{link.label}</span>
            {link.detail ? <span className="text-body-caption text-muted-foreground">{link.detail}</span> : null}
            {link.count ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-body-caption text-primary-foreground">
                {formatNumber(link.count, locale)}
              </span>
            ) : null}
            <Icon icon={ChevronRight} size="xs" className="text-muted-foreground rtl:-scale-x-100" />
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lead text-foreground">{t("account.mySignUps")}</h2>
        {signUps.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={t("account.noSignUps")}
            action={
              <Button asChild size="sm" variant="outline">
                <Link href="/events">{t("home.allEvents")}</Link>
              </Button>
            }
            className="rounded-card-lg border border-dashed border-border py-10"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {signUps.map(({ registration, event }) => (
              <li key={registration.id}>
                <Link
                  href={`/events/${event.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-card-md border border-border p-3 hover:bg-muted",
                    focusRing,
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-small-strong text-foreground">
                      {eventTitle(event, locale)}
                    </span>
                    <span className="text-body-caption text-muted-foreground">
                      {formatOrderDate(event.startsAt, locale)}
                    </span>
                  </span>
                  <span className="text-body-caption text-muted-foreground">
                    {t("events.seatCount", {
                      count: registration.seats,
                      formatted: formatNumber(registration.seats, locale),
                    })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LocaleToggle />
        <SignOutButton />
      </div>
    </div>
  );
}

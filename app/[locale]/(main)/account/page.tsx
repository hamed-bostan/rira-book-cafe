import { getTranslations } from "next-intl/server";

import { requireAuth } from "@/src/lib/require-auth";
import { sessionHas } from "@/src/lib/require-permission";
import { noIndexMetadata } from "@/src/presentation/seo/noIndexMetadata";
import { AccountScreen } from "@/src/presentation/storefront/account/AccountScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  return noIndexMetadata(t("account.heading"));
}

export default async function AccountPage() {
  const session = await requireAuth();

  const [profile, registrations, events, canOpenDashboard, unreadNotifications, loyalty] = await Promise.all([
    storefrontServerApi.profile(),
    storefrontServerApi.myRegistrations(),
    storefrontServerApi.upcomingEvents(),
    sessionHas(session, "dashboard.view"),
    storefrontServerApi.unreadNotificationCount(),
    storefrontServerApi.loyalty(),
  ]);

  // Upcoming sign-ups only: the public event list holds the events still ahead.
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const signUps = registrations.flatMap((registration) => {
    const event = eventsById.get(registration.eventId);
    return registration.status === "registered" && event ? [{ registration, event }] : [];
  });

  return (
    <AccountScreen
      profile={profile}
      signUps={signUps}
      canOpenDashboard={canOpenDashboard}
      unreadNotifications={unreadNotifications}
      pointsBalance={loyalty.balance}
    />
  );
}

import { getTranslations } from "next-intl/server";

import { DashboardLinkTabs } from "../DashboardLinkTabs";

export const EVENT_TABS = ["upcoming", "past"] as const;
export type EventTab = (typeof EVENT_TABS)[number];

type EventTabsProps = {
  current: EventTab;
  counts: Record<EventTab, number>;
};

/** Upcoming / Past along the top of the event list, each with its count. */
export async function EventTabs({ current, counts }: EventTabsProps) {
  const t = await getTranslations("dashEvents");

  return (
    <DashboardLinkTabs
      label={t("tabsLabel")}
      current={current}
      tabs={EVENT_TABS.map((tab) => ({
        key: tab,
        label: tab === "upcoming" ? t("upcomingHeading") : t("pastHeading"),
        count: counts[tab],
        href: tab === "upcoming" ? "/dashboard/events" : `/dashboard/events?tab=${tab}`,
      }))}
    />
  );
}

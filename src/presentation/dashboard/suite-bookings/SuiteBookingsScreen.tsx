import { getTranslations } from "next-intl/server";

import { shiftCafeDay } from "@/src/domain/entities/CafeTime";
import {
  MAX_SUITE_GUESTS,
  firstFreeNight,
  heldClashFor,
  holdsSuite,
  type SuiteBooking,
} from "@/src/domain/entities/SuiteBooking";
import { cn } from "@/src/lib/utils";

import { DashboardEmptyState } from "../DashboardEmptyState";
import { DashboardLinkTabs } from "../DashboardLinkTabs";

import { NewStayDialog } from "./NewStayDialog";
import { SuiteAvailability } from "./SuiteAvailability";
import { WINDOW_LEAD_DAYS } from "./suiteCalendar";
import { SuiteStayRow } from "./SuiteStayRow";

export const SUITE_TABS = ["upcoming", "past"] as const;
export type SuiteTab = (typeof SUITE_TABS)[number];

/** Stays still in play — the Upcoming tab; everything else is Past. */
const OPEN = ["requested", "confirmed", "checkedIn"];

type SuiteBookingsScreenProps = {
  /** Every stay that ends after the earliest day the page needs (calendar or Past tab). */
  bookings: SuiteBooking[];
  today: string;
  /** First day on the availability strip. */
  windowStart: string;
  tab: SuiteTab;
  /** The stay picked from the strip or just booked, tinted in the list. */
  focusId: string | undefined;
  canManage: boolean;
};

/**
 * The suite desk: a three-week availability strip (held stays and requests on
 * separate rows, so clashes show at once) over the stays list in Upcoming / Past
 * tabs. Presentational: the page fetches over the REST API (BFF); the strip's
 * start, tab and focus live in the URL, and every action `router.refresh()`es.
 */
export async function SuiteBookingsScreen({
  bookings,
  today,
  windowStart,
  tab,
  focusId,
  canManage,
}: SuiteBookingsScreenProps) {
  const t = await getTranslations("dashSuite");

  const upcoming = bookings
    .filter((b) => OPEN.includes(b.status))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.reference - b.reference);
  const past = bookings
    .filter((b) => !OPEN.includes(b.status))
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn) || b.reference - a.reference);
  const shown = tab === "upcoming" ? upcoming : past;
  const requests = bookings.filter((b) => b.status === "requested").length;
  const held = bookings.filter(holdsSuite);

  const home = shiftCafeDay(today, -WINDOW_LEAD_DAYS);
  const hrefFor = ({ start, toTab, focus }: { start: string; toTab: SuiteTab; focus?: string }): string => {
    const params = new URLSearchParams();
    if (start !== home) params.set("from", start);
    if (toTab !== "upcoming") params.set("tab", toTab);
    if (focus) params.set("focus", focus);
    const query = params.toString();
    return `/dashboard/suite${query ? `?${query}` : ""}${focus ? `#stay-${focus}` : ""}`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="flex flex-wrap items-center gap-x-2 text-body-default text-muted-foreground sm:text-body-small">
            <span>{t("subtitle", { guests: MAX_SUITE_GUESTS })}</span>
            {requests > 0 ? (
              <>
                <span aria-hidden>·</span>
                <span className="font-semibold text-warning-foreground">
                  {t("requestsWaiting", { count: requests })}
                </span>
              </>
            ) : null}
          </p>
        </div>
        {canManage ? <NewStayDialog held={held} today={today} firstFree={firstFreeNight(held, today)} /> : null}
      </div>

      <SuiteAvailability
        bookings={bookings}
        windowStart={windowStart}
        today={today}
        focusId={focusId}
        hrefForStay={(booking) =>
          hrefFor({ start: windowStart, toTab: OPEN.includes(booking.status) ? "upcoming" : "past", focus: booking.id })
        }
        hrefForWindow={(start) => hrefFor({ start, toTab: tab })}
      />

      <section
        aria-label={t("staysLabel")}
        className="min-w-0 rounded-card-lg border border-border bg-background shadow-xs"
      >
        <DashboardLinkTabs
          className="px-4"
          label={t("tabsLabel")}
          current={tab}
          tabs={SUITE_TABS.map((value) => ({
            key: value,
            label: value === "upcoming" ? t("tabUpcoming") : t("tabPast"),
            count: value === "upcoming" ? upcoming.length : past.length,
            href: hrefFor({ start: windowStart, toTab: value }),
          }))}
        />
        {shown.length > 0 ? (
          <ul>
            {shown.map((booking, index) => (
              <li key={booking.id} className={cn(index > 0 && "border-t border-border")}>
                <SuiteStayRow
                  booking={booking}
                  clash={heldClashFor(booking, bookings)}
                  today={today}
                  focused={booking.id === focusId}
                  canManage={canManage}
                />
              </li>
            ))}
          </ul>
        ) : (
          <DashboardEmptyState
            title={tab === "upcoming" ? t("emptyUpcomingTitle") : t("emptyPastTitle")}
            body={tab === "upcoming" ? t("emptyUpcomingBody") : t("emptyPastBody")}
          />
        )}
      </section>
    </div>
  );
}

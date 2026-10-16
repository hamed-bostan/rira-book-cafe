import { getTranslations } from "next-intl/server";

import { SUITE_BOOKING_STATUSES, type SuiteBooking } from "@/src/domain/entities/SuiteBooking";
import { AutoRefresh } from "@/src/presentation/components/AutoRefresh";
import { ListFilterSelect } from "@/src/presentation/dashboard/list";

import { SuiteBookingCard } from "./SuiteBookingCard";

const REFRESH_SECONDS = 60;

type SuiteBookingsScreenProps = {
  bookings: SuiteBooking[];
  /** Whether a status filter is applied — to tell "no stays" from "no matches". */
  isFiltered: boolean;
  canManage: boolean;
};

/**
 * The suite's book: every stay from today on, in check-in order. Presentational:
 * the page fetches over the REST API (BFF). The status filter lives in the URL;
 * the list re-reads itself while open, and every action `router.refresh()`es.
 */
export async function SuiteBookingsScreen({ bookings, isFiltered, canManage }: SuiteBookingsScreenProps) {
  const t = await getTranslations("dashSuite");
  const waiting = bookings.filter((booking) => booking.status === "requested").length;

  return (
    <div className="@container flex min-w-0 flex-col gap-4 sm:gap-6">
      <AutoRefresh intervalSeconds={REFRESH_SECONDS} />

      <div className="flex flex-col gap-3">
        <div className="space-y-1">
          <h1 className="dashboard-page-title">{t("heading")}</h1>
          <p className="text-body-small text-muted-foreground">{t("subtitle", { waiting })}</p>
        </div>
        <div className="min-w-48 self-start">
          <ListFilterSelect
            className="h-9 w-full"
            paramName="status"
            label={t("filterStatusLabel")}
            options={[
              { value: "", label: t("filterStatusOption", { status: t("filterStatusAll") }) },
              ...SUITE_BOOKING_STATUSES.map((status) => ({
                value: status,
                label: t("filterStatusOption", { status: t(`status.${status}`) }),
              })),
            ]}
          />
        </div>
      </div>

      {bookings.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {bookings.map((booking) => (
            <SuiteBookingCard key={booking.id} booking={booking} canManage={canManage} />
          ))}
        </ul>
      ) : (
        <div className="rounded-card-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-body-strong text-foreground">{isFiltered ? t("noMatchesTitle") : t("emptyTitle")}</p>
          <p className="mt-1 text-body-small text-muted-foreground">{isFiltered ? t("noMatchesBody") : t("emptyBody")}</p>
        </div>
      )}
    </div>
  );
}

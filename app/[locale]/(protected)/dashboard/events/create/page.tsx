import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { EventForm } from "@/src/presentation/dashboard/events/EventForm";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";

export default async function CreateEventPage() {
  await requirePermission("events.manage");
  const t = await getTranslations("dashEvents");

  return (
    <>
      <DashboardPageCrumb label={t("newEvent")} />
      <EventForm mode="create" />
    </>
  );
}

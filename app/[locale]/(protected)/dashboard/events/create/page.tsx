import { getTranslations } from "next-intl/server";

import { requirePermission } from "@/src/lib/require-permission";
import { EventForm } from "@/src/presentation/dashboard/events/EventForm";

export default async function CreateEventPage() {
  await requirePermission("events.manage");
  const t = await getTranslations("dashEvents");

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="dashboard-page-title">{t("newEvent")}</h1>
        <p className="text-body-small text-muted-foreground">{t("createSubtitle")}</p>
      </div>
      <EventForm mode="create" />
    </div>
  );
}

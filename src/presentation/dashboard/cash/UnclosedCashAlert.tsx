import { AlertTriangle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { CashCloseStatus } from "@/src/domain/entities/CashClose";
import { Link } from "@/src/i18n/navigation";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";

/** How many days the warning names before "and N more". */
const SHOWN = 5;

/**
 * The warning that the till hasn't been closed: past days with cash movements and
 * no close. Each links to the close for that day. Renders nothing when every day
 * is closed.
 */
export async function UnclosedCashAlert({ status }: { status: CashCloseStatus }) {
  if (status.unclosedDays.length === 0) return null;
  const t = await getTranslations("dashCash");
  const locale = await getLocale();
  const days = status.unclosedDays;

  return (
    <section className="flex flex-col gap-3 rounded-card-lg border border-warning-foreground bg-warning px-4 py-4 text-warning-foreground md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        <h2 className="text-body-strong">{t("alert.title", { count: days.length })}</h2>
        <Link href={`/dashboard/cash?day=${days[0]}`} className="ms-auto text-body-small-emphasis underline underline-offset-4">
          {t("alert.open")}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-2">
        {days.slice(0, SHOWN).map((day) => (
          <li key={day}>
            <Link href={`/dashboard/cash?day=${day}`} className="block rounded-full border border-warning-foreground bg-background px-3 py-1 text-body-caption">
              {formatCafeDayMedium(day, locale)}
            </Link>
          </li>
        ))}
        {days.length > SHOWN ? <li className="px-1 py-1 text-body-caption">{t("alert.more", { count: days.length - SHOWN })}</li> : null}
      </ul>
      <p className="text-body-caption">{t("alert.hint")}</p>
    </section>
  );
}

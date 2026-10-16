import { BedDouble, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { Link } from "@/src/i18n/navigation";
import { requireAuth } from "@/src/lib/require-auth";
import { cn } from "@/src/lib/utils";
import { Icon, focusRing } from "@/src/presentation/design-system";
import { BookTableForm } from "@/src/presentation/storefront/reservations/BookTableForm";

export const dynamic = "force-dynamic";

/** Ask for a table. Booking needs an account (staff see the guest's name and phone), so signed-out guests sign in first. */
export default async function BookTablePage() {
  await requireAuth();
  const t = await getTranslations("site");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-heading-page text-foreground">{t("book.heading")}</h1>
        <p className="mt-1 text-body-small text-muted-foreground">{t("book.subtitle")}</p>
      </div>
      <BookTableForm today={cafeDayOf(new Date())} />
      <Link href="/suite" className={cn("flex items-center gap-3 rounded-card-lg border border-border px-4 py-4 hover:bg-muted", focusRing)}>
        <Icon icon={BedDouble} size="sm" className="text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-body-small-strong text-foreground">{t("suite.promoTitle")}</span>
          <span className="block text-body-caption text-muted-foreground">{t("suite.promoBody")}</span>
        </span>
        <Icon icon={ChevronRight} size="xs" className="text-muted-foreground rtl:-scale-x-100" />
      </Link>
    </div>
  );
}

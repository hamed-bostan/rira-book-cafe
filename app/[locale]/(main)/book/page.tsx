import { getTranslations } from "next-intl/server";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { requireAuth } from "@/src/lib/require-auth";
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
    </div>
  );
}

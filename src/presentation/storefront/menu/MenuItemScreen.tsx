import { ChevronLeft, ShoppingBag } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import type { BookWaitlistStatus } from "@/src/domain/entities/BookWaitlist";
import { isSellable, type Product } from "@/src/domain/entities/Product";
import type { PublicReview, ReviewEligibility } from "@/src/domain/entities/ProductReview";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { AddToBasketForm } from "./AddToBasketForm";
import { BookWaitlistPanel } from "./BookWaitlistPanel";
import { ProductReviews } from "./ProductReviews";

type MenuItemScreenProps = {
  item: Product;
  reviews: PublicReview[];
  /** The signed-in guest's review standing; `null` when signed out. */
  reviewEligibility: ReviewEligibility | null;
  /** For books: the lending line. `null` for drinks and food. */
  waitlist: BookWaitlistStatus | null;
  signedIn: boolean;
};

/**
 * One item's page: photo, price, the copy staff wrote (description, nutrition,
 * origin), book details for books, the add-to-basket form, and what guests thought.
 */
export async function MenuItemScreen({ item, reviews, reviewEligibility, waitlist, signedIn }: MenuItemScreenProps) {
  const t = await getTranslations("site");
  const tProducts = await getTranslations("dashProducts");
  const tDietary = await getTranslations("dietary");
  const locale = await getLocale();
  const sellable = isSellable(item);
  const soldOut = item.stockQuantity <= 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/menu"
        className="inline-flex w-fit items-center gap-1 text-body-small-strong text-muted-foreground hover:text-foreground"
      >
        <Icon icon={ChevronLeft} size="xs" className="rtl:-scale-x-100" />
        {t("menu.back")}
      </Link>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-card-lg bg-muted">
          <FadeInImage
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(min-width: 1152px) 548px, (min-width: 768px) 50vw, 100vw"
            className="object-cover"
            preload
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{tProducts(`kind.${item.kind}`)}</Badge>
            {item.badge ? <Badge variant="success">{item.badge}</Badge> : null}
            {item.dietary?.map((tag) => (
              <Badge key={tag} variant="neutral">
                {tDietary(tag as Parameters<typeof tDietary>[0])}
              </Badge>
            ))}
          </div>
          <div>
            <h1 className="text-heading-page text-foreground">{item.name}</h1>
            {item.book ? (
              <p className="mt-1 text-body-default text-muted-foreground">
                {t("menu.byAuthor", { author: item.book.author })}
              </p>
            ) : null}
            {item.unit ? <p className="mt-1 text-body-small text-muted-foreground">{item.unit}</p> : null}
          </div>
          <p className="text-heading-subsection text-foreground">
            {formatMoney(item.price, locale)}
            {item.originalPrice ? (
              <span className="ms-2 text-body-default text-muted-foreground line-through">
                {formatMoney(item.originalPrice, locale)}
              </span>
            ) : null}
          </p>

          {item.book ? (
            <p className="rounded-card-md bg-muted px-4 py-3 text-body-small text-foreground">
              {t(`menu.bookAvailability.${item.book.availability}`)}
              {item.book.isbn ? (
                <span className="ms-2 text-muted-foreground" dir="ltr">
                  ISBN {item.book.isbn}
                </span>
              ) : null}
            </p>
          ) : null}

          {waitlist ? <BookWaitlistPanel productId={item.id} status={waitlist} signedIn={signedIn} /> : null}

          {!sellable ? null : soldOut ? (
            <p className="rounded-card-md border border-border px-4 py-3 text-body-small text-muted-foreground">
              {t("menu.soldOutLong")}
            </p>
          ) : (
            <AddToBasketForm item={item} />
          )}

          <Link
            href="/basket"
            className="inline-flex w-fit items-center gap-1.5 text-body-small-emphasis text-primary underline-offset-4 hover:underline"
          >
            <Icon icon={ShoppingBag} size="xs" />
            {t("menu.viewBasket")}
          </Link>

          {item.description ? (
            <section>
              <h2 className="text-body-strong text-foreground">{t("menu.about")}</h2>
              <p className="mt-1 text-body-default whitespace-pre-wrap text-muted-foreground">{item.description}</p>
            </section>
          ) : null}
          {item.origin ? (
            <section>
              <h2 className="text-body-strong text-foreground">{t("menu.origin")}</h2>
              <p className="mt-1 text-body-small whitespace-pre-wrap text-muted-foreground">{item.origin}</p>
            </section>
          ) : null}
          {item.nutrition ? (
            <section>
              <h2 className="text-body-strong text-foreground">{t("menu.nutrition")}</h2>
              <p className="mt-1 text-body-small whitespace-pre-wrap text-muted-foreground">{item.nutrition}</p>
            </section>
          ) : null}
        </div>
      </div>

      <ProductReviews
        productId={item.id}
        rating={item.rating}
        ratingCount={item.ratingCount}
        reviews={reviews}
        eligibility={reviewEligibility}
      />
    </div>
  );
}

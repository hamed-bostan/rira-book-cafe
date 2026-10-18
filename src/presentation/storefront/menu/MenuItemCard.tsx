import { getLocale, getTranslations } from "next-intl/server";

import { isSellable, type Product } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { Badge } from "@/src/presentation/design-system/components/Badge/Badge";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { interactiveCard, zoomOnGroupHover } from "@/src/presentation/design-system/components/shared/motion";

import { AddToBasketButton } from "./AddToBasketButton";

type MenuItemCardProps = {
  item: Product;
  /** Preload the photo — for the cards that are likely the page's largest paint. */
  preload?: boolean;
};

/**
 * One menu item: photo, name, price, and a quick add. Books show their author and
 * whether they're for sale or for reading here; a reading-only book has no add
 * button, and a sold-out item says so instead.
 */

export async function MenuItemCard({ item, preload = false }: MenuItemCardProps) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const soldOut = item.stockQuantity <= 0;
  const sellable = isSellable(item);

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-card-lg border border-border bg-background",
        interactiveCard,
      )}
    >
      {/* A pointer-only shortcut: the name link below is the card's one link for keyboard
          and screen-reader users, so this duplicate (a decorative image, no text) stays out
          of the tab order and the accessibility tree. */}
      <Link href={`/menu/${item.id}`} tabIndex={-1} aria-hidden className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <FadeInImage
            src={item.imageUrl}
            alt=""
            fill
            sizes="(min-width: 1152px) 272px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={cn("object-cover", zoomOnGroupHover)}
            preload={preload}
          />
          {item.badge ? (
            <span className="absolute start-2 top-2">
              <Badge variant="primary">{item.badge}</Badge>
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link
          href={`/menu/${item.id}`}
          className={cn("text-body-small-strong text-foreground hover:text-primary", focusRing)}
        >
          {item.name}
        </Link>
        {item.book ? <p className="text-body-caption text-muted-foreground">{item.book.author}</p> : null}
        {item.unit ? <p className="text-body-caption text-muted-foreground">{item.unit}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-body-small-emphasis text-foreground">
            {formatMoney(item.price, locale)}
            {item.originalPrice ? (
              <span className="ms-1.5 text-body-caption text-muted-foreground line-through">
                {formatMoney(item.originalPrice, locale)}
              </span>
            ) : null}
          </span>
          {!sellable ? (
            <Badge variant="info">{t("menu.readingOnly")}</Badge>
          ) : soldOut ? (
            <Badge variant="neutral">{t("menu.soldOut")}</Badge>
          ) : (
            <AddToBasketButton item={item} />
          )}
        </div>
      </div>
    </article>
  );
}

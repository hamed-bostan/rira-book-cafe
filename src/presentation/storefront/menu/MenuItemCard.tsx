import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { isSellable, type Product } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { Badge, focusRing } from "@/src/presentation/design-system";

import { AddToBasketButton } from "./AddToBasketButton";

/**
 * One menu item: photo, name, price, and a quick add. Books show their author and
 * whether they're for sale or for reading here; a reading-only book has no add
 * button, and a sold-out item says so instead.
 */
export async function MenuItemCard({ item }: { item: Product }) {
  const t = await getTranslations("site");
  const locale = await getLocale();
  const soldOut = item.stockQuantity <= 0;
  const sellable = isSellable(item);

  return (
    <article className="flex flex-col overflow-hidden rounded-card-lg border border-border bg-background">
      {/* A pointer-only shortcut: the name link below is the card's one link for keyboard
          and screen-reader users, so this duplicate (a decorative image, no text) stays out
          of the tab order and the accessibility tree. */}
      <Link href={`/menu/${item.id}`} tabIndex={-1} aria-hidden className="block">
        <div className="relative aspect-[4/3] bg-muted">
          <Image src={item.imageUrl} alt="" fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover" />
          {item.badge ? (
            <span className="absolute start-2 top-2">
              <Badge variant="primary">{item.badge}</Badge>
            </span>
          ) : null}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Link href={`/menu/${item.id}`} className={cn("text-body-small-strong text-foreground hover:text-primary", focusRing)}>
          {item.name}
        </Link>
        {item.book ? <p className="text-body-caption text-muted-foreground">{item.book.author}</p> : null}
        {item.unit ? <p className="text-body-caption text-muted-foreground">{item.unit}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-body-small-emphasis text-foreground">
            {formatMoney(item.price, locale)}
            {item.originalPrice ? (
              <span className="ms-1.5 text-body-caption text-muted-foreground line-through">{formatMoney(item.originalPrice, locale)}</span>
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

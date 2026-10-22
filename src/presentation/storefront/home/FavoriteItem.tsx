import { getLocale } from "next-intl/server";

import type { Product } from "@/src/domain/entities/Product";
import { Link } from "@/src/i18n/navigation";
import { formatMoney } from "@/src/lib/formatMoney";
import { cn } from "@/src/lib/utils";
import { FadeInImage } from "@/src/presentation/components/FadeInImage";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

type FavoriteItemProps = {
  item: Product;
};

/**
 * One featured item in the favourites row: picture, name, a line about it, and the
 * price. The name is the one link to the item; the picture is a pointer shortcut.
 */
export async function FavoriteItem({ item }: FavoriteItemProps) {
  const locale = await getLocale();
  const blurb = item.description ?? item.book?.author ?? item.unit;

  return (
    <article className="flex flex-col items-center gap-2 border-landing-border px-2 py-6 not-last:border-b sm:px-4 sm:pt-0 sm:pb-2 sm:not-last:border-e sm:not-last:border-b-0">
      <Link
        href={`/menu/${item.id}`}
        tabIndex={-1}
        aria-hidden
        className="cut-corner-sm relative block h-36 w-48 overflow-hidden rounded-sm bg-landing-background"
      >
        <FadeInImage src={item.imageUrl} alt="" fill sizes="192px" className="object-cover" />
      </Link>
      <h3 className="mt-2 text-heading-section text-landing-ink">
        <Link href={`/menu/${item.id}`} className={cn("rounded-sm hover:text-landing-primary", focusRing)}>
          {item.name}
        </Link>
      </h3>
      {blurb ? <p className="line-clamp-2 max-w-xs text-body-default text-landing-ink-muted">{blurb}</p> : null}
      <p className="mt-1 text-heading-subsection text-landing-ink">{formatMoney(item.price, locale)}</p>
    </article>
  );
}

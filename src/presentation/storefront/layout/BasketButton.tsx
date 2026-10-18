"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { basketCount } from "../basket/basket";
import { useBasket } from "../basket/BasketProvider";

/**
 * The header's basket link, with how many items are in it. The count pops when
 * it goes up, so adding from a card deep in the menu visibly lands somewhere.
 */
export function BasketButton() {
  const t = useTranslations("site");
  const locale = useLocale();
  const { basket, ready } = useBasket();
  const count = basketCount(basket);

  // Bump only on a real increase after the basket has hydrated — not when the
  // stored basket first appears, and not when an item is removed. Derived during
  // render from the previous snapshot (no effect), per React's "storing
  // information from previous renders" pattern.
  const [previous, setPrevious] = React.useState({ count, ready });
  const [bumps, setBumps] = React.useState(0);
  if (previous.count !== count || previous.ready !== ready) {
    if (previous.ready && ready && count > previous.count) setBumps(bumps + 1);
    setPrevious({ count, ready });
  }

  return (
    <Link
      href="/basket"
      aria-label={t("basketAria", { count })}
      className={cn("relative grid size-11 place-items-center rounded-full text-foreground hover:bg-muted", focusRing)}
    >
      <Icon icon={ShoppingBag} size="sm" />
      {ready && count > 0 ? (
        <span
          // A new key remounts the badge, replaying the animation on every bump.
          key={bumps}
          className={cn(
            "absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-label-compact text-primary-foreground",
            bumps > 0 && "motion-safe:animate-bump",
          )}
        >
          {formatNumber(count, locale)}
        </span>
      ) : null}
    </Link>
  );
}

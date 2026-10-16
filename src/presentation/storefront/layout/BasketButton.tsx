"use client";

import { ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/src/i18n/navigation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import { Icon, focusRing } from "@/src/presentation/design-system";

import { basketCount } from "../basket/basket";
import { useBasket } from "../basket/BasketProvider";

/** The header's basket link, with how many items are in it. */
export function BasketButton() {
  const t = useTranslations("site");
  const locale = useLocale();
  const { basket, ready } = useBasket();
  const count = basketCount(basket);

  return (
    <Link
      href="/basket"
      aria-label={t("basketAria", { count })}
      className={cn("relative grid size-11 place-items-center rounded-full text-foreground hover:bg-muted", focusRing)}
    >
      <Icon icon={ShoppingBag} size="sm" />
      {ready && count > 0 ? (
        <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-primary px-1 text-label-compact text-primary-foreground">
          {formatNumber(count, locale)}
        </span>
      ) : null}
    </Link>
  );
}

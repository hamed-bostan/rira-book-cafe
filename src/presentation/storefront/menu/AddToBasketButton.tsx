"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { Product } from "@/src/domain/entities/Product";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useBasket } from "../basket/BasketProvider";

type AddToBasketButtonProps = {
  item: Pick<Product, "id" | "name" | "imageUrl" | "kind" | "price">;
  quantity?: number;
  note?: string;
  /** Called after adding — the detail form resets its fields. */
  onAdded?: () => void;
  size?: "sm" | "md";
  label?: string;
};

/** Adds an item to the basket, with a brief "Added" confirmation in place of the label. */
export function AddToBasketButton({ item, quantity = 1, note, onAdded, size = "sm", label }: AddToBasketButtonProps) {
  const t = useTranslations("site");
  const { add } = useBasket();
  const [added, setAdded] = React.useState(false);

  React.useEffect(() => {
    if (!added) return;
    const timer = window.setTimeout(() => setAdded(false), 1500);
    return () => window.clearTimeout(timer);
  }, [added]);

  return (
    <Button
      type="button"
      size={size}
      variant={added ? "soft" : "primary"}
      aria-label={label ?? t("menu.addAria", { name: item.name })}
      onClick={() => {
        add({
          productId: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          kind: item.kind,
          unitPrice: item.price,
          quantity,
          note,
        });
        setAdded(true);
        onAdded?.();
      }}
    >
      <Icon icon={added ? Check : Plus} size="sm" className="me-1" />
      {added ? t("menu.added") : t("menu.add")}
    </Button>
  );
}

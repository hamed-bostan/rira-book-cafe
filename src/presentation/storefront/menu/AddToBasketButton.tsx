"use client";

import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import type { Product } from "@/src/domain/entities/Product";
import type { OrderItemOption } from "@/src/domain/entities/ProductOptions";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { useBasketActions } from "../basket/BasketProvider";

type AddToBasketButtonProps = {
  item: Pick<Product, "id" | "name" | "imageUrl" | "kind" | "price">;
  quantity?: number;
  note?: string;
  /** The options chosen on the item's page, and what one unit then costs. */
  choice?: { choiceIds: string[]; options: OrderItemOption[]; unitPrice: number };
  /** Off while the item's required options aren't chosen yet. */
  disabled?: boolean;
  /** Called after adding — the detail form resets its fields. */
  onAdded?: () => void;
  size?: "sm" | "md";
  label?: string;
};

/** Adds an item to the basket, with a brief "Added" confirmation in place of the label. */
export function AddToBasketButton({
  item,
  quantity = 1,
  note,
  choice,
  disabled = false,
  onAdded,
  size = "sm",
  label,
}: AddToBasketButtonProps) {
  const t = useTranslations("site");
  const { add } = useBasketActions();
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
      disabled={disabled}
      onClick={() => {
        add({
          productId: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          kind: item.kind,
          unitPrice: choice?.unitPrice ?? item.price,
          quantity,
          note,
          ...(choice && choice.choiceIds.length > 0 ? { choiceIds: choice.choiceIds, options: choice.options } : {}),
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

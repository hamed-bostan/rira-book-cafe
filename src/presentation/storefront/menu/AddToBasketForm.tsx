"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_ORDER_NOTE_TEXT_LENGTH } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { maxLineQuantity } from "@/src/domain/entities/stock";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { AddToBasketButton } from "./AddToBasketButton";

/** Quantity, an optional request ("oat milk"), and add — on the item's own page. */
export function AddToBasketForm({
  item,
}: {
  item: Pick<Product, "id" | "name" | "imageUrl" | "kind" | "price" | "stockQuantity" | "madeToOrder">;
}) {
  const t = useTranslations("site");
  const locale = useLocale();
  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const max = maxLineQuantity(item);

  return (
    <div className="flex flex-col gap-4 rounded-card-lg border border-border p-4">
      <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
        {t("menu.noteLabel")}
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_ORDER_NOTE_TEXT_LENGTH}
          rows={2}
          placeholder={t("menu.notePlaceholder")}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="group" aria-label={t("menu.quantity")}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconOnly
            aria-label={t("menu.decrease")}
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => q - 1)}
          >
            <Icon icon={Minus} size="sm" />
          </Button>
          <span className="w-8 text-center text-body-strong tabular-nums" aria-live="polite">
            {formatNumber(quantity, locale)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            iconOnly
            aria-label={t("menu.increase")}
            disabled={quantity >= max}
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Icon icon={Plus} size="sm" />
          </Button>
        </div>
        <AddToBasketButton
          item={item}
          quantity={quantity}
          note={note}
          size="md"
          label={t("menu.addWithTotal", { total: formatMoney(item.price * quantity, locale) })}
          onAdded={() => {
            setQuantity(1);
            setNote("");
          }}
        />
      </div>
    </div>
  );
}

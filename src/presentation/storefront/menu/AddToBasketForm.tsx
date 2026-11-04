"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_ORDER_NOTE_TEXT_LENGTH } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import {
  defaultChoiceIds,
  optionSelectionProblem,
  optionsDelta,
  snapshotOptions,
} from "@/src/domain/entities/ProductOptions";
import { maxLineQuantity } from "@/src/domain/entities/stock";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Textarea } from "@/src/presentation/design-system/components/form/Textarea/Textarea";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { ProductOptionsPicker } from "@/src/presentation/product/ProductOptionsPicker";

import { AddToBasketButton } from "./AddToBasketButton";

/**
 * Options (when the item has them), quantity, an optional request ("less sugar"),
 * and add — on the item's own page. The total follows the choices as they're made;
 * Add waits until every required group is answered. The figure is the menu's now:
 * the server prices the order again when it's placed.
 */
export function AddToBasketForm({
  item,
}: {
  item: Pick<Product, "id" | "name" | "imageUrl" | "kind" | "price" | "stockQuantity" | "madeToOrder" | "optionGroups">;
}) {
  const t = useTranslations("site");
  const tOptions = useTranslations("productOptions");
  const locale = useLocale();
  const groups = item.optionGroups ?? [];
  const [quantity, setQuantity] = React.useState(1);
  const [note, setNote] = React.useState("");
  const [choiceIds, setChoiceIds] = React.useState<string[]>(() => defaultChoiceIds(groups));
  const max = maxLineQuantity(item);

  const options = snapshotOptions(groups, choiceIds);
  const unitPrice = item.price + optionsDelta(options);
  const incomplete = groups.length > 0 && optionSelectionProblem(groups, choiceIds) !== null;

  return (
    <div className="flex flex-col gap-4 rounded-card-lg border border-border p-4">
      {groups.length > 0 ? <ProductOptionsPicker groups={groups} value={choiceIds} onChange={setChoiceIds} /> : null}
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
        <div className="flex items-center gap-3">
          {groups.length > 0 ? (
            <span className="text-body-strong text-foreground tabular-nums" aria-live="polite" data-testid="live-total">
              {formatMoney(unitPrice * quantity, locale)}
            </span>
          ) : null}
          <AddToBasketButton
            item={item}
            quantity={quantity}
            note={note}
            choice={groups.length > 0 ? { choiceIds, options, unitPrice } : undefined}
            disabled={incomplete}
            size="md"
            label={t("menu.addWithTotal", { total: formatMoney(unitPrice * quantity, locale) })}
            onAdded={() => {
              setQuantity(1);
              setNote("");
              setChoiceIds(defaultChoiceIds(groups));
            }}
          />
        </div>
      </div>
      {incomplete ? <p className="text-body-caption text-muted-foreground">{tOptions("incomplete")}</p> : null}
    </div>
  );
}

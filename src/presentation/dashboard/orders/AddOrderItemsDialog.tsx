"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { MAX_LINE_QUANTITY, MAX_ORDER_NOTE_TEXT_LENGTH, type Order } from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardDialog } from "@/src/presentation/dashboard/DashboardDialog";
import { FIELD_LABEL } from "@/src/presentation/dashboard/fieldStyles";
import { ROW_CAPTION, ROW_TEXT } from "@/src/presentation/dashboard/pageStyles";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "./order-api";

/** What the round can be picked from: the menu as it is now, with what's left of counted items. */
export type MenuPick = Pick<Product, "id" | "name" | "price" | "imageUrl" | "madeToOrder" | "stockQuantity">;

type AddOrderItemsDialogProps = {
  order: Pick<Order, "id" | "orderNumber" | "updatedAt">;
  products: readonly MenuPick[];
};

/** One line of the round: how many, and the guest's request for it. */
type RoundLine = { quantity: number; note: string };

/** How many of an item can still go in the round: counted items stop at what's on the shelf. */
function maxQuantity(product: MenuPick): number {
  return product.madeToOrder ? MAX_LINE_QUANTITY : Math.min(product.stockQuantity, MAX_LINE_QUANTITY);
}

/**
 * Add a second round to an order: pick from the menu as at New sale, each line with
 * a note if the guest asks for something. The figure shown is the menu's price; the
 * server prices the round, and re-prices the order with its promo code and points.
 * Writes over the API, then refreshes the server render.
 */
export function AddOrderItemsDialog({ order, products }: AddOrderItemsDialogProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [round, setRound] = React.useState<Readonly<Record<string, RoundLine>>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const term = query.trim().toLowerCase();
  const shown = term ? products.filter((product) => product.name.toLowerCase().includes(term)) : products;
  const lines = products.flatMap((product) => {
    const line = round[product.id];
    return line && line.quantity > 0 ? [{ product, ...line }] : [];
  });
  const amount = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  function setLine(id: string, next: Partial<RoundLine>): void {
    setRound((current) => {
      const line: RoundLine = { ...(current[id] ?? { quantity: 0, note: "" }), ...next };
      return { ...current, [id]: { ...line, quantity: Math.max(line.quantity, 0) } };
    });
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await ordersApi.update(order.id, {
          version: order.updatedAt,
          add: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity, note: line.note })),
        });
        toast({ tone: "success", title: t("edit.addSaved", { number: order.orderNumber }) });
        setOpen(false);
        setRound({});
        setQuery("");
      } catch (err) {
        const field =
          err instanceof ApiError ? Object.values(err.fieldErrors ?? {}).find((message) => message.length > 0) : null;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ?? localizeApiError(err, tApiErrors, t("edit.error")),
        );
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <Icon icon={Plus} size="icon-md" className="me-2" />
        {t("edit.addOpen")}
      </Button>
      <DashboardDialog
        open={open}
        onOpenChange={setOpen}
        title={t("edit.addTitle", { number: order.orderNumber })}
        subtitle={t("edit.addSubtitle")}
        submitLabel={t("edit.addSubmit")}
        blocked={lines.length === 0}
        pending={pending}
        onSubmit={submit}
        preview={
          lines.length > 0
            ? t("edit.addPreview", {
                count,
                countFormatted: formatNumber(count, locale),
                amount: formatMoney(amount, locale),
              })
            : undefined
        }
        error={error}
      >
        <Input
          size="control-md"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("counter.searchLabel")}
          placeholder={t("counter.searchLabel")}
          autoComplete="off"
          dir="auto"
        />
        {shown.length === 0 ? (
          <p className="text-muted-foreground">{t("counter.noMatches")}</p>
        ) : (
          <ul
            aria-label={t("counter.menuHeading")}
            className="max-h-64 overflow-y-auto rounded-button border border-border"
          >
            {shown.map((product) => {
              const inRound = round[product.id]?.quantity ?? 0;
              const left = maxQuantity(product);
              return (
                <li key={product.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    disabled={inRound >= left}
                    onClick={() => setLine(product.id, { quantity: inRound + 1 })}
                    aria-label={t("counter.addAria", { name: product.name })}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                      focusRing,
                    )}
                  >
                    <ProductThumbnail src={product.imageUrl} size="line" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span dir="auto" className={cn(ROW_TEXT, "truncate font-medium text-foreground")}>
                        {product.name}
                      </span>
                      <span className={cn(ROW_CAPTION, "tabular-nums")}>
                        {formatMoney(product.price, locale)}
                        {left === 0 ? ` · ${t("counter.soldOut")}` : null}
                      </span>
                    </span>
                    {inRound > 0 ? (
                      <span className={cn(ROW_TEXT, "font-semibold text-primary tabular-nums")}>
                        ×{formatNumber(inRound, locale)}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {lines.length > 0 ? (
          <div className="flex flex-col gap-4">
            <p className={FIELD_LABEL}>{t("edit.roundHeading")}</p>
            {lines.map(({ product, quantity, note }) => (
              <div
                key={product.id}
                className="flex flex-col gap-2 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span dir="auto" className={cn(ROW_TEXT, "truncate text-foreground")}>
                      {product.name}
                    </span>
                    <span className={cn(ROW_CAPTION, "tabular-nums")}>
                      {formatMoney(product.price * quantity, locale)}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="control-sm"
                    iconOnly
                    aria-label={t("counter.decreaseAria", { name: product.name })}
                    onClick={() => setLine(product.id, { quantity: quantity - 1 })}
                  >
                    <Icon icon={Minus} size="icon-md" />
                  </Button>
                  <span className={cn(ROW_TEXT, "w-6 text-center tabular-nums")}>{formatNumber(quantity, locale)}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="control-sm"
                    iconOnly
                    aria-label={t("counter.increaseAria", { name: product.name })}
                    disabled={quantity >= maxQuantity(product)}
                    onClick={() => setLine(product.id, { quantity: quantity + 1 })}
                  >
                    <Icon icon={Plus} size="icon-md" />
                  </Button>
                </div>
                <Input
                  size="control-md"
                  value={note}
                  onChange={(event) => setLine(product.id, { note: event.target.value })}
                  aria-label={t("edit.lineNoteAria", { name: product.name })}
                  placeholder={t("edit.lineNotePlaceholder")}
                  maxLength={MAX_ORDER_NOTE_TEXT_LENGTH}
                  autoComplete="off"
                  dir="auto"
                />
              </div>
            ))}
          </div>
        ) : null}
      </DashboardDialog>
    </>
  );
}

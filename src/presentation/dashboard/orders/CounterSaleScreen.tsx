"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { CounterOrderFormInput } from "@/src/contracts/order-schema";
import {
  COUNTER_PAYMENT_METHODS,
  MAX_LINE_QUANTITY,
  MAX_TABLE_LABEL_LENGTH,
  type CounterPaymentPart,
  type ServiceType,
} from "@/src/domain/entities/Order";
import type { Product } from "@/src/domain/entities/Product";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatMoney } from "@/src/lib/formatMoney";
import { formatNumber } from "@/src/lib/formatNumber";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { DashboardColumns } from "@/src/presentation/dashboard/DashboardColumns";
import { DashboardField } from "@/src/presentation/dashboard/DashboardField";
import { DashboardPageHeader } from "@/src/presentation/dashboard/DashboardPageHeader";
import { DashboardSection } from "@/src/presentation/dashboard/DashboardSection";
import { DashboardSwitchField } from "@/src/presentation/dashboard/DashboardSwitchField";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { FormAlert } from "@/src/presentation/dashboard/FormAlert";
import { OverviewSegmented } from "@/src/presentation/dashboard/overview/OverviewSegmented";
import { AMOUNT, ROW_CAPTION, ROW_TEXT } from "@/src/presentation/dashboard/pageStyles";
import { ProductThumbnail } from "@/src/presentation/dashboard/ProductThumbnail";
import { DashboardPageCrumb } from "@/src/presentation/dashboard/shell/DashboardPageCrumb";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { CounterSaleDone } from "./CounterSaleDone";
import { ordersApi } from "./order-api";
import { splitParts, splitRemainder, type SplitAmounts } from "./paymentParts";
import { PaymentPartsFields } from "./PaymentPartsFields";

/** How the sale is settled: later, one method, or split between them. */
const PAYMENT_CHOICES = ["later", ...COUNTER_PAYMENT_METHODS, "split"] as const;
type PaymentChoice = (typeof PAYMENT_CHOICES)[number];

type CounterSaleScreenProps = {
  /** What's on the menu right now, with what's left of counted items. */
  products: readonly Pick<Product, "id" | "name" | "price" | "imageUrl" | "madeToOrder" | "stockQuantity">[];
};

/** How many of an item can still go in the basket: counted items stop at what's on the shelf. */
function maxQuantity(product: CounterSaleScreenProps["products"][number]): number {
  return product.madeToOrder ? MAX_LINE_QUANTITY : Math.min(product.stockQuantity, MAX_LINE_QUANTITY);
}

/**
 * Ring up a sale at the counter: pick from the menu, say how it's served, and take
 * the money there and then or leave it to pay later. Prices stay on the server, as on
 * a guest's order; the total here is only what the menu says now. The screen resets
 * for the next guest after each sale, and `router.refresh()` re-reads what's left on
 * the shelf.
 */
export function CounterSaleScreen({ products }: CounterSaleScreenProps) {
  const t = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const [query, setQuery] = React.useState("");
  const [basket, setBasket] = React.useState<Readonly<Record<string, number>>>({});
  const [serviceType, setServiceType] = React.useState<ServiceType>("takeaway");
  const [tableLabel, setTableLabel] = React.useState("");
  const [customerName, setCustomerName] = React.useState(t("counter.walkIn"));
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [note, setNote] = React.useState("");
  const [payment, setPayment] = React.useState<PaymentChoice>("cash");
  const [amounts, setAmounts] = React.useState<SplitAmounts>({});
  const [complete, setComplete] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  /** The sale just rung up, with the way to it and its receipt, until the next one. */
  const [lastSale, setLastSale] = React.useState<{ id: string; number: number } | null>(null);
  const [pending, startTransition] = React.useTransition();

  const term = query.trim().toLowerCase();
  const shown = term ? products.filter((product) => product.name.toLowerCase().includes(term)) : products;
  const lines = products.flatMap((product) => {
    const quantity = basket[product.id] ?? 0;
    return quantity > 0 ? [{ product, quantity }] : [];
  });
  const total = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  const parts: CounterPaymentPart[] | undefined =
    payment === "later" ? undefined : payment === "split" ? splitParts(amounts) : [{ method: payment, amount: total }];
  const paymentReady = payment !== "split" || (splitRemainder(parts ?? [], total) === 0 && (parts?.length ?? 0) > 0);
  const ready =
    lines.length > 0 && customerName.trim() !== "" && (serviceType !== "dineIn" || tableLabel.trim() !== "");

  function setQuantity(id: string, quantity: number): void {
    setBasket((current) => ({ ...current, [id]: Math.max(quantity, 0) }));
  }

  function submit(): void {
    const values: CounterOrderFormInput = {
      items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      serviceType,
      tableLabel: serviceType === "dineIn" ? tableLabel : undefined,
      note,
      customerName,
      customerPhone,
      paymentParts: total > 0 ? parts : undefined,
      complete,
    };
    setError(null);
    setLastSale(null);
    startTransition(async () => {
      try {
        const order = await ordersApi.createCounterSale(values);
        toast({ tone: "success", title: t("counter.saved", { number: order.orderNumber }) });
        setLastSale({ id: order.id, number: order.orderNumber });
        setBasket({});
        setQuery("");
        setNote("");
        setTableLabel("");
        setCustomerName(t("counter.walkIn"));
        setCustomerPhone("");
        setAmounts({});
        router.refresh();
      } catch (err) {
        const field =
          err instanceof ApiError ? Object.values(err.fieldErrors ?? {}).find((message) => message.length > 0) : null;
        setError(
          (field ? formErrorMessage(tFormErrors, field) : null) ??
            localizeApiError(err, tApiErrors, t("counter.error")),
        );
      }
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <DashboardPageCrumb label={t("counter.heading")} />
      <DashboardPageHeader
        backHref="/dashboard/orders"
        backLabel={t("backToOrders")}
        title={t("counter.heading")}
        subtitle={t("counter.subtitle")}
      />

      <DashboardColumns
        main={
          <DashboardSection title={t("counter.menuHeading")} flush>
            <div className="border-b border-border p-4">
              <Input
                size="control-md"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label={t("counter.searchLabel")}
                placeholder={t("counter.searchLabel")}
                autoComplete="off"
                dir="auto"
              />
            </div>
            {shown.length === 0 ? (
              <p className="p-5 text-muted-foreground">{t("counter.noMatches")}</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2">
                {shown.map((product) => {
                  const inBasket = basket[product.id] ?? 0;
                  const left = maxQuantity(product);
                  return (
                    <li key={product.id} className="border-b border-border sm:odd:border-e">
                      <button
                        type="button"
                        disabled={inBasket >= left}
                        onClick={() => setQuantity(product.id, inBasket + 1)}
                        aria-label={t("counter.addAria", { name: product.name })}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
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
                        {inBasket > 0 ? (
                          <span className={cn(ROW_TEXT, "font-semibold text-primary tabular-nums")}>
                            ×{formatNumber(inBasket, locale)}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashboardSection>
        }
        side={
          <>
            <DashboardSection title={t("counter.saleHeading")} flush>
              {lines.length === 0 ? (
                <p className="p-5 text-muted-foreground">{t("counter.basketEmpty")}</p>
              ) : (
                <ul>
                  {lines.map(({ product, quantity }) => (
                    <li
                      key={product.id}
                      className="flex items-center gap-2 border-b border-border px-5 py-3 last:border-b-0"
                    >
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
                        onClick={() => setQuantity(product.id, quantity - 1)}
                      >
                        <Icon icon={Minus} size="icon-md" />
                      </Button>
                      <span className={cn(ROW_TEXT, "w-6 text-center tabular-nums")}>
                        {formatNumber(quantity, locale)}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="control-sm"
                        iconOnly
                        aria-label={t("counter.increaseAria", { name: product.name })}
                        disabled={quantity >= maxQuantity(product)}
                        onClick={() => setQuantity(product.id, quantity + 1)}
                      >
                        <Icon icon={Plus} size="icon-md" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-baseline justify-between gap-3 border-t border-border px-5 py-4">
                <span className="font-bold text-foreground">{t("total")}</span>
                <span className={cn(AMOUNT, "font-bold text-foreground")}>{formatMoney(total, locale)}</span>
              </div>
            </DashboardSection>

            <DashboardSection title={t("counter.detailsHeading")}>
              <div className="flex flex-col gap-4">
                <DashboardField label={t("counter.customerLabel")}>
                  <Input
                    size="control-md"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    autoComplete="off"
                    dir="auto"
                  />
                </DashboardField>
                <DashboardField label={t("counter.phoneLabel")}>
                  <Input
                    size="control-md"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    autoComplete="off"
                    inputMode="tel"
                    dir="ltr"
                  />
                </DashboardField>
                <div className="flex flex-col gap-2">
                  <OverviewSegmented
                    label={t("colService")}
                    value={serviceType}
                    onChange={setServiceType}
                    fill
                    options={[
                      { value: "takeaway", label: t("service.takeaway") },
                      { value: "dineIn", label: t("service.dineIn") },
                    ]}
                  />
                  {serviceType === "dineIn" ? (
                    <DashboardField label={t("counter.tableLabel")}>
                      <Input
                        size="control-md"
                        value={tableLabel}
                        onChange={(event) => setTableLabel(event.target.value)}
                        maxLength={MAX_TABLE_LABEL_LENGTH}
                        autoComplete="off"
                        dir="auto"
                      />
                    </DashboardField>
                  ) : null}
                </div>
                <DashboardField label={t("counter.noteLabel")}>
                  <Input
                    size="control-md"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    autoComplete="off"
                    dir="auto"
                  />
                </DashboardField>
              </div>
            </DashboardSection>

            <DashboardSection title={t("filterPayment")}>
              <div className="flex flex-col gap-4">
                <div role="group" aria-label={t("filterPayment")} className="grid grid-cols-2 gap-2">
                  {PAYMENT_CHOICES.map((choice) => (
                    <Button
                      key={choice}
                      type="button"
                      variant={payment === choice ? "primary" : "secondary"}
                      size="control-md"
                      className="px-3"
                      aria-pressed={payment === choice}
                      onClick={() => setPayment(choice)}
                    >
                      {choice === "later" || choice === "split"
                        ? t(`counter.payment.${choice}`)
                        : t(`paymentMethod.${choice}`)}
                    </Button>
                  ))}
                </div>
                {payment === "split" ? (
                  <PaymentPartsFields total={total} amounts={amounts} onChange={setAmounts} disabled={pending} />
                ) : null}
                <DashboardSwitchField
                  label={t("counter.completeLabel")}
                  hint={t("counter.completeHint")}
                  checked={complete}
                  onCheckedChange={setComplete}
                />
                {error ? <FormAlert>{error}</FormAlert> : null}
                <Button
                  type="button"
                  size="control-md"
                  className="w-full"
                  loading={pending}
                  disabled={!ready || !paymentReady}
                  onClick={submit}
                >
                  {t("counter.submit")}
                </Button>
                {!ready && lines.length > 0 ? <p className={FIELD_HINT}>{t("counter.incomplete")}</p> : null}
                {lastSale ? <CounterSaleDone orderId={lastSale.id} orderNumber={lastSale.number} /> : null}
              </div>
            </DashboardSection>
          </>
        }
      />
    </div>
  );
}

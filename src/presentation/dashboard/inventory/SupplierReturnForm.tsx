"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { REFUND_CHOICES, supplierReturnSchema, type SupplierReturnFormInput } from "@/src/contracts/inventory-schema";
import { settleSupplierCredit, type StockItem } from "@/src/domain/entities/Inventory";
import type { ReturnableDelivery } from "@/src/domain/repositories/IInventoryRepository";
import { Link, useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formatCafeDayMedium } from "@/src/lib/formatCafeDay";
import { formatMoney } from "@/src/lib/formatMoney";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardFormField } from "../DashboardFormField";
import { FIELD_GRID, FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";
import { FormAlert } from "../FormAlert";
import { AMOUNT_INPUT, LINE_ROW, PAGE_CARD, ROW_CAPTION } from "../pageStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { inventoryApi } from "./inventory-api";
import { UNIT_INSIDE, UNIT_SUFFIX } from "./stockFieldStyles";
import { formatStockQuantity } from "./stockFormat";

type SupplierReturnFormProps = {
  /** What can go back: active items with stock on hand. */
  items: StockItem[];
  suppliers: { id: string; name: string }[];
  deliveries: ReturnableDelivery[];
  today: string;
  /** Opened from an item's menu or a delivery's page. */
  initialItemId?: string;
  initialExpenseId?: string;
};

const EMPTY_LINE = { ingredientId: "", quantity: "" };
const WHOLE = /^\d+$/;
const FIELDS = ["date", "supplierId", "expenseId", "creditAmount", "vatAmount", "refundTo"] as const;

/**
 * Stock going back to a supplier: who to, the delivery it came on (its bill takes
 * the credit first), what goes back — never more than is on hand — and the credit
 * note's total and VAT. As it's filled in it says how the credit will be settled:
 * off what's still owed on the bill, and the rest back as money, to cash or the
 * bank. The goods leave stock at their average cost.
 */
export function SupplierReturnForm({
  items,
  suppliers,
  deliveries,
  today,
  initialItemId,
  initialExpenseId,
}: SupplierReturnFormProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const locale = useLocale();
  const router = useRouter();
  const { toast } = useToast();

  const initialDelivery = deliveries.find((delivery) => delivery.id === initialExpenseId);
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SupplierReturnFormInput>({
    resolver: zodResolver(supplierReturnSchema, undefined, { raw: true }),
    defaultValues: {
      date: today,
      supplierId: initialDelivery?.supplierId ?? "",
      expenseId: initialDelivery?.id ?? "",
      lines: [{ ingredientId: initialItemId ?? "", quantity: "" }],
      creditAmount: "",
      vatAmount: "",
      refundTo: "",
      note: "",
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const [supplierId, expenseId, lines, creditText] = useWatch({
    control,
    name: ["supplierId", "expenseId", "lines", "creditAmount"],
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  const supplierDeliveries = deliveries.filter((delivery) => delivery.supplierId === supplierId);
  const delivery = supplierDeliveries.find((candidate) => candidate.id === expenseId);
  const credit = WHOLE.test(creditText.trim()) ? Number(creditText) : 0;
  const settlement = settleSupplierCredit(credit, delivery?.owed ?? 0);
  const linesError = errors.lines?.root?.message ?? errors.lines?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await inventoryApi.returnToSupplier(values);
      toast({ tone: "success", title: t("returns.saved", { number: saved.number }) });
      router.push("/dashboard/inventory/returns");
      router.refresh();
    } catch (error) {
      let applied = false;
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors?.[field];
          if (message) {
            setError(field, { message });
            applied = true;
          }
        }
      }
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("returns.error")) });
    }
  });

  let settles: string | undefined;
  if (credit > 0) {
    const parts = [
      delivery && settlement.applied > 0
        ? t("returns.settleBill", {
            amount: formatMoney(settlement.applied, locale),
            number: delivery.number,
          })
        : null,
      settlement.refunded > 0 ? t("returns.settleRefund", { amount: formatMoney(settlement.refunded, locale) }) : null,
    ].filter((part): part is string => part !== null);
    settles = parts.join(" ");
  }

  return (
    <form onSubmit={onSubmit} className={cn(PAGE_CARD, "flex flex-col gap-5 p-5")} noValidate>
      <div className={FIELD_GRID}>
        <DashboardFormField label={t("dateLabel")} required error={fieldError(errors.date?.message)}>
          {(field) => (
            <Input
              {...field}
              {...register("date")}
              size="control-md"
              type="date"
              max={today}
              dir="ltr"
              inputClassName={FIELD_INPUT}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("returns.supplierLabel")} required error={fieldError(errors.supplierId?.message)}>
          {(field) => (
            <Select
              {...field}
              {...register("supplierId", { onChange: () => setValue("expenseId", "") })}
              size="control-md"
              className="border-border-strong"
            >
              <option value="">{t("returns.supplierPlaceholder")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("returns.deliveryLabel")}
          hint={t("returns.deliveryHint")}
          error={fieldError(errors.expenseId?.message)}
        >
          {(field) => (
            <Select
              {...field}
              {...register("expenseId")}
              size="control-md"
              className="border-border-strong"
              disabled={supplierDeliveries.length === 0}
            >
              <option value="">{t("returns.noDelivery")}</option>
              {supplierDeliveries.map((option) => (
                <option key={option.id} value={option.id}>
                  {t("returns.deliveryOption", {
                    number: option.number,
                    date: formatCafeDayMedium(option.date, locale),
                    description: option.description,
                  })}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className={cn(FIELD_LABEL, "mb-3")}>{t("returns.linesLabel")}</legend>
        {linesError ? <FormMessage>{fieldError(linesError)}</FormMessage> : null}
        {fields.map((field, index) => {
          const item = byId.get(lines[index]?.ingredientId ?? "");
          const lineErrors = errors.lines?.[index];
          const unit = item ? t(`unit.${item.unit}`) : "";
          return (
            <div
              key={field.id}
              className={cn(
                LINE_ROW,
                "grid-cols-[minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_2.25rem] md:grid-cols-[minmax(0,2fr)_12rem_2.25rem]",
              )}
            >
              <div className="col-span-full flex min-w-0 flex-col gap-1 md:col-span-1">
                <Select
                  {...register(`lines.${index}.ingredientId`)}
                  size="control-md"
                  aria-label={t("lines.item")}
                  className="border-border-strong"
                >
                  <option value="">{t("lines.itemPlaceholder")}</option>
                  {items.map((option) => (
                    <option key={option.id} value={option.id}>
                      {t("quick.itemOption", {
                        name: option.name,
                        quantity: formatStockQuantity(option.onHand, locale),
                        unit: t(`unit.${option.unit}`),
                      })}
                    </option>
                  ))}
                </Select>
                {lineErrors?.ingredientId?.message ? (
                  <FormMessage>{fieldError(lineErrors.ingredientId.message)}</FormMessage>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="relative">
                  <Input
                    {...register(`lines.${index}.quantity`)}
                    size="control-md"
                    inputMode="decimal"
                    placeholder={t("lines.quantity")}
                    aria-label={t("lines.quantity")}
                    inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT, UNIT_INSIDE)}
                    dir="ltr"
                  />
                  <span aria-hidden className={UNIT_SUFFIX}>
                    {unit}
                  </span>
                </div>
                {lineErrors?.quantity?.message ? (
                  <FormMessage>{fieldError(lineErrors.quantity.message)}</FormMessage>
                ) : item ? (
                  <span className={ROW_CAPTION}>
                    {t("returns.onHand", {
                      quantity: t("quick.quantity", { quantity: formatStockQuantity(item.onHand, locale), unit }),
                    })}
                  </span>
                ) : null}
              </div>
              <RemoveLineButton label={t("lines.remove")} onClick={() => remove(index)} disabled={fields.length <= 1} />
            </div>
          );
        })}
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="w-fit px-3"
          onClick={() => append(EMPTY_LINE)}
        >
          <Icon icon={Plus} size="icon-md" className="me-2" />
          {t("lines.add")}
        </Button>
      </fieldset>

      <div className={FIELD_GRID}>
        <DashboardFormField
          label={t("returns.creditLabel")}
          hint={t("returns.creditHint")}
          error={fieldError(errors.creditAmount?.message)}
        >
          {(field) => (
            <Input
              {...field}
              {...register("creditAmount")}
              size="control-md"
              inputMode="numeric"
              dir="ltr"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField label={t("returns.vatLabel")} error={fieldError(errors.vatAmount?.message)}>
          {(field) => (
            <Input
              {...field}
              {...register("vatAmount")}
              size="control-md"
              inputMode="numeric"
              dir="ltr"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("returns.refundLabel")}
          hint={settlement.refunded > 0 ? t("returns.refundNeeded") : t("returns.refundHint")}
          error={fieldError(errors.refundTo?.message)}
        >
          {(field) => (
            <Select {...field} {...register("refundTo")} size="control-md" className="border-border-strong">
              {REFUND_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {t(`returns.refundTo.${choice || "none"}`)}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
      </div>
      {settles ? (
        <p className="rounded-card-md bg-muted px-4 py-3 text-body-default text-foreground/80 sm:text-body-small">
          {settles}
        </p>
      ) : null}
      <DashboardFormField label={t("returns.noteLabel")} error={fieldError(errors.note?.message)}>
        {(field) => (
          <Input
            {...field}
            {...register("note")}
            size="control-md"
            dir="auto"
            maxLength={200}
            placeholder={t("returns.notePlaceholder")}
            inputClassName={FIELD_INPUT}
          />
        )}
      </DashboardFormField>

      {errors.root?.message ? <FormAlert>{errors.root.message}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="control-md" className="px-4" loading={isSubmitting}>
          {t("returns.save")}
        </Button>
        <Button asChild variant="secondary" size="control-md" className="px-3">
          <Link href="/dashboard/inventory/returns">{t("cancel")}</Link>
        </Button>
      </div>
    </form>
  );
}

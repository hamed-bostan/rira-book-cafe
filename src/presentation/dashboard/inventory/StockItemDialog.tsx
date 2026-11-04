"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFieldArray, useForm, useWatch } from "react-hook-form";

import { stockItemSchema, type StockItemFormInput } from "@/src/contracts/inventory-schema";
import type { StockItem } from "@/src/domain/entities/Inventory";
import { INGREDIENT_UNITS, isUnitLocked, MAX_PURCHASE_UNITS } from "@/src/domain/entities/Pricing";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardFormField } from "../DashboardFormField";
import { FIELD_GRID, FIELD_HINT, FIELD_INPUT, FIELD_LABEL } from "../fieldStyles";
import { RemoveLineButton } from "../RemoveLineButton";

import { stockItemsApi } from "./inventory-api";

type StockItemDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item to edit; a new one when absent. */
  item?: StockItem;
  /** Who it can be bought from. */
  suppliers: readonly { id: string; name: string }[];
};

const FIELDS = ["name", "unit", "reorderLevel", "parLevel", "purchaseUnits", "supplierId"] as const;

function toDefaults(item?: StockItem): StockItemFormInput {
  return {
    name: item?.name ?? "",
    unit: item?.unit ?? "g",
    reorderLevel: item?.reorderLevel === undefined ? "" : String(item.reorderLevel),
    parLevel: item?.parLevel === undefined ? "" : String(item.parLevel),
    purchaseUnits: (item?.purchaseUnits ?? []).map((unit) => ({ name: unit.name, factor: String(unit.factor) })),
    supplierId: item?.supplierId ?? "",
  };
}

/**
 * Make a stock item, or change how one is kept: its name and unit (fixed once it
 * has stock history), the level it's flagged at and the level a delivery tops it
 * up to, the packs it's bought in ("bag = 1000 g") and who it's usually bought
 * from. What it costs comes from deliveries (and Pricing), so it isn't asked here.
 */
export function StockItemDialog({ open, onOpenChange, item, suppliers }: StockItemDialogProps) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const fieldError = (message?: string): string | undefined => formErrorMessage(tFormErrors, message);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StockItemFormInput>({
    resolver: zodResolver(stockItemSchema, undefined, { raw: true }),
    defaultValues: toDefaults(item),
  });
  const { fields, append, remove } = useFieldArray({ control, name: "purchaseUnits" });
  const unit = useWatch({ control, name: "unit" });
  const unitLocked = item !== undefined && isUnitLocked(item);
  const unitName = t(`unit.${unit}`);
  const unitsError = errors.purchaseUnits?.root?.message ?? errors.purchaseUnits?.message;

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (item) await stockItemsApi.update(item.id, values);
      else await stockItemsApi.create(values);
      onOpenChange(false);
      toast({ tone: "success", title: t("item.saved", { name: values.name.trim() }) });
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
      if (!applied) setError("root", { message: localizeApiError(error, tApiErrors, t("item.error")) });
    }
  });

  return (
    <DashboardDialog
      open={open}
      onOpenChange={onOpenChange}
      title={item ? t("item.editTitle", { name: item.name }) : t("item.newTitle")}
      subtitle={t("item.subtitle")}
      submitLabel={item ? t("item.save") : t("item.create")}
      backLabel={t("cancel")}
      pending={isSubmitting}
      onSubmit={() => void onSubmit()}
      error={errors.root?.message}
    >
      <DashboardFormField label={t("item.nameLabel")} required error={fieldError(errors.name?.message)}>
        {(wiring) => (
          <Input
            {...wiring}
            {...register("name")}
            size="control-md"
            inputClassName={FIELD_INPUT}
            dir="auto"
            placeholder={t("item.namePlaceholder")}
          />
        )}
      </DashboardFormField>
      <div className={FIELD_GRID}>
        <DashboardFormField
          label={t("item.unitLabel")}
          hint={unitLocked ? t("item.unitLocked") : undefined}
          error={fieldError(errors.unit?.message)}
        >
          {(wiring) =>
            unitLocked ? (
              // Shown, not chosen: the form keeps the saved unit and sends it back.
              <Select {...wiring} value={unit} disabled size="control-md" className="border-border-strong">
                <option value={unit}>{t(`unitName.${unit}`)}</option>
              </Select>
            ) : (
              <Select {...wiring} {...register("unit")} size="control-md" className="border-border-strong">
                {INGREDIENT_UNITS.map((option) => (
                  <option key={option} value={option}>
                    {t(`unitName.${option}`)}
                  </option>
                ))}
              </Select>
            )
          }
        </DashboardFormField>
        <DashboardFormField label={t("item.supplierLabel")} error={fieldError(errors.supplierId?.message)}>
          {(wiring) => (
            <Select {...wiring} {...register("supplierId")} size="control-md" className="border-border-strong">
              <option value="">{t("item.noSupplier")}</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </Select>
          )}
        </DashboardFormField>
      </div>
      <div className={FIELD_GRID}>
        <DashboardFormField
          label={t("item.reorderLabel", { unit: unitName })}
          hint={t("item.reorderHint")}
          error={fieldError(errors.reorderLevel?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("reorderLevel")}
              size="control-md"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
        <DashboardFormField
          label={t("item.parLabel", { unit: unitName })}
          hint={t("item.parHint")}
          error={fieldError(errors.parLevel?.message)}
        >
          {(wiring) => (
            <Input
              {...wiring}
              {...register("parLevel")}
              size="control-md"
              inputMode="decimal"
              dir="ltr"
              autoComplete="off"
              inputClassName={cn(FIELD_INPUT, "tabular-nums")}
            />
          )}
        </DashboardFormField>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className={cn(FIELD_LABEL, "mb-1")}>{t("item.packsLabel")}</legend>
        <p className={FIELD_HINT}>{t("item.packsHint", { unit: unitName })}</p>
        {unitsError ? <FormMessage>{fieldError(unitsError)}</FormMessage> : null}
        {fields.map((field, index) => {
          const lineErrors = errors.purchaseUnits?.[index];
          return (
            <div key={field.id} className="flex min-w-0 flex-col gap-1">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_2.25rem]">
                <Input
                  {...register(`purchaseUnits.${index}.name`)}
                  size="control-md"
                  dir="auto"
                  autoComplete="off"
                  aria-label={t("item.packName")}
                  placeholder={t("item.packNamePlaceholder")}
                  inputClassName={FIELD_INPUT}
                />
                <span aria-hidden className="text-muted-foreground">
                  =
                </span>
                <div dir="ltr">
                  <Input
                    {...register(`purchaseUnits.${index}.factor`)}
                    size="control-md"
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={t("item.packFactor", { unit: unitName })}
                    placeholder="1000"
                    inputClassName={cn(FIELD_INPUT, "pe-16 tabular-nums")}
                    rightElement={<span className="pointer-events-none text-muted-foreground">{unitName}</span>}
                  />
                </div>
                <RemoveLineButton label={t("item.packRemove")} onClick={() => remove(index)} />
              </div>
              {lineErrors?.name?.message || lineErrors?.factor?.message ? (
                <FormMessage>{fieldError(lineErrors.name?.message ?? lineErrors.factor?.message)}</FormMessage>
              ) : null}
            </div>
          );
        })}
        {fields.length < MAX_PURCHASE_UNITS ? (
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className="w-fit px-3"
            onClick={() => append({ name: "", factor: "" })}
          >
            <Icon icon={Plus} size="icon-md" className="me-2" />
            {t("item.packAdd")}
          </Button>
        ) : null}
      </fieldset>
    </DashboardDialog>
  );
}

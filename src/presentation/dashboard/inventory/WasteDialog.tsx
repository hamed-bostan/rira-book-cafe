"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cafeDayOf } from "@/src/domain/entities/CafeTime";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button, FormMessage, Icon, Input, Modal, ModalContent, useToast } from "@/src/presentation/design-system";

import { inventoryApi } from "./inventory-api";

/** Record spoiled, spilled or expired stock — it leaves Inventory at average cost. */
export function WasteDialog({ id, name, unit }: { id: string; name: string; unit: string }) {
  const t = useTranslations("dashInventory");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const today = cafeDayOf(new Date());
  const [open, setOpen] = React.useState(false);
  const [quantity, setQuantity] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await inventoryApi.recordWaste({ date: today, ingredientId: id, quantity, note });
        setOpen(false);
        setQuantity("");
        setNote("");
        toast({ tone: "success", title: t("waste.saved") });
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("waste.error")));
      }
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={t("waste.open", { name })}>
        <Icon icon={Trash2} size="sm" />
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("waste.title", { name })} className="max-w-md">
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (quantity.trim()) submit();
            }}
          >
            <p className="text-body-small text-muted-foreground">{t("waste.description")}</p>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("waste.quantityLabel", { unit })}
              <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" dir="ltr" autoFocus />
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("waste.noteLabel")}
              <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} dir="auto" placeholder={t("waste.notePlaceholder")} />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" loading={pending} disabled={!quantity.trim()}>
                {t("waste.confirm")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

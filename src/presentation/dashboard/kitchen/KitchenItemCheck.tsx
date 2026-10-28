"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { ordersApi } from "../orders/order-api";

type KitchenItemCheckProps = {
  orderId: string;
  itemId: string;
  /** "2", in the reader's digits. */
  quantity: string;
  name: string;
  /** The guest's request for the line ("Oat milk · Extra hot"). */
  note?: string;
  /** Whether the line is already ticked off — the order's per-line served mark. */
  served: boolean;
};

/**
 * One line of an order being made, as a big tick-box row: tap anywhere on it to
 * tick the line off (it's marked served) or take a mistaken tick back. Writes,
 * then refreshes the server render, which draws the new state.
 */
export function KitchenItemCheck({ orderId, itemId, quantity, name, note, served }: KitchenItemCheckProps) {
  const tOrders = useTranslations("dashOrders");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function toggle(): void {
    if (pending) return;
    startTransition(async () => {
      try {
        await ordersApi.setItemServed(orderId, itemId, { served: !served });
      } catch (err) {
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, tOrders("serveError")) });
      }
      router.refresh();
    });
  }

  return (
    <CheckboxPrimitive.Root
      checked={served}
      onCheckedChange={toggle}
      aria-busy={pending || undefined}
      className={cn(
        "group flex min-h-11 w-full cursor-pointer items-start gap-3 py-2 text-start transition-colors hover:bg-canvas sm:min-h-10",
        pending && "opacity-60",
        focusRing,
      )}
    >
      <span
        aria-hidden
        className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-checkbox border-2 border-border-strong bg-background text-primary-foreground group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary sm:size-5"
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-4" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex gap-2 text-body-lead font-semibold text-foreground group-data-[state=checked]:text-muted-foreground group-data-[state=checked]:line-through lg:text-heading-subsection">
          <span className="shrink-0 tabular-nums">{quantity}×</span>
          <span className="min-w-0">{name}</span>
        </span>
        {note ? (
          <span className="text-body-default font-medium text-muted-foreground sm:text-body-small">{note}</span>
        ) : null}
      </span>
    </CheckboxPrimitive.Root>
  );
}

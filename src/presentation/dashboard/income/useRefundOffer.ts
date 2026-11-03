"use client";

import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { moneyField } from "@/src/contracts/money-fields";
import type { IncomeMethod } from "@/src/domain/entities/Income";
import { formatMoney } from "@/src/lib/formatMoney";
import { expenseApiErrorMessage } from "@/src/presentation/dashboard/expenses/expenseApiErrorMessage";
import { normalizeAmount } from "@/src/presentation/dashboard/expenses/expenseFormat";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { incomeRefundsApi, type RefundTarget } from "./income-refund-api";

/** A paid booking being cancelled: who gets the money back, and how much is theirs to have. */
export type RefundOffer = {
  target: RefundTarget;
  guestName: string;
  /** Paid and not yet refunded, in Toman. */
  left: number;
};

export type RefundOfferState = {
  offer: RefundOffer;
  checked: boolean;
  setChecked: (checked: boolean) => void;
  amount: string;
  setAmount: (amount: string) => void;
  method: IncomeMethod;
  setMethod: (method: IncomeMethod) => void;
  /** What's wrong with the amount, while the refund is ticked. */
  fieldError?: string;
  /** Ticked with an amount that can't go back: the cancel waits. */
  blocked: boolean;
  /** Once the cancel has gone through: hand the money back, if ticked. Says how it went in a toast. */
  run: () => Promise<void>;
};

/**
 * The refund a cancel dialog offers for a paid stay or sign-up: unticked, the whole
 * of what's left, by cash. Ticked, the cancel and then the refund go through in one
 * click; a refund that fails after the cancel says so and leaves the row's Refund
 * button to try again. `null` when there's nothing to give back.
 */
export function useRefundOffer(offer: RefundOffer | undefined): RefundOfferState | null {
  const t = useTranslations("dashIncome");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const locale = useLocale();
  const { toast } = useToast();
  const [checked, setChecked] = React.useState(false);
  /** What's typed over the suggestion; `null` while the whole of what's left stands. */
  const [typed, setTyped] = React.useState<string | null>(null);
  const [method, setMethod] = React.useState<IncomeMethod>("cash");

  if (!offer || offer.left <= 0) return null;
  const amount = typed ?? String(offer.left);
  const parsed = moneyField.safeParse(normalizeAmount(amount));
  const fieldError = !checked
    ? undefined
    : !parsed.success
      ? tFormErrors("amountInvalid")
      : parsed.data > offer.left
        ? tFormErrors("refundOverPaid")
        : undefined;

  async function run(): Promise<void> {
    if (!checked || !offer || !parsed.success) return;
    try {
      await incomeRefundsApi.create(offer.target, { amount: normalizeAmount(amount), method, reason: "" });
      toast({
        tone: "success",
        title: t("refund.done", { amount: formatMoney(parsed.data, locale), name: offer.guestName }),
      });
    } catch (err) {
      toast({
        tone: "error",
        title: t("refund.offerFailed", {
          message: expenseApiErrorMessage(err, tFormErrors, tApiErrors, t("refund.error")),
        }),
      });
    }
  }

  return {
    offer,
    checked,
    setChecked,
    amount,
    setAmount: setTyped,
    method,
    setMethod,
    fieldError,
    blocked: fieldError !== undefined,
    run,
  };
}

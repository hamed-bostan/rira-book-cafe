"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { PAYMENT_SOURCES, type PaymentSource } from "@/src/domain/entities/Expense";
import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Select } from "@/src/presentation/design-system/components/form/Select/Select";
import { Modal, ModalContent } from "@/src/presentation/design-system/components/Modal/Modal";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { expensesApi } from "./expense-api";

type PayExpenseButtonProps = { id: string; number: number; expenseDate: string; today: string };

/** Pay an owed expense from cash or the bank, on a day between when it was incurred and today. */
export function PayExpenseButton({ id, number, expenseDate, today }: PayExpenseButtonProps) {
  const t = useTranslations("dashExpenses");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<PaymentSource>("bank");
  const [paidOn, setPaidOn] = React.useState(today);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      try {
        await expensesApi.pay(id, { source, paidOn });
        toast({ tone: "success", title: t("detail.paid", { number }) });
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(localizeApiError(err, tApiErrors, t("detail.payError")));
      }
    });
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t("detail.pay")}
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t("detail.payTitle", { number })} className="max-w-md">
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("detail.paySource")}
              <Select value={source} onChange={(event) => setSource(event.target.value as PaymentSource)}>
                {PAYMENT_SOURCES.map((option) => (
                  <option key={option} value={option}>
                    {t(`form.payment.${option}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("detail.paidOn")}
              <Input
                type="date"
                value={paidOn}
                min={expenseDate}
                max={today}
                onChange={(event) => setPaidOn(event.target.value)}
                dir="ltr"
              />
            </label>
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" loading={pending} disabled={!paidOn}>
                {t("detail.payConfirm")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

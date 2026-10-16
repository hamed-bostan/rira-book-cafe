"use client";

import { Banknote, EllipsisVertical, Globe, Percent, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { RecordStatementLineInput } from "@/src/contracts/bank-schema";
import type { BankStatementLine } from "@/src/domain/entities/BankReconciliation";
import { formatMoney } from "@/src/lib/formatMoney";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Icon,
  Input,
  Modal,
  ModalContent,
} from "@/src/presentation/design-system";

type StatementLineActionsProps = {
  line: BankStatementLine;
  disabled: boolean;
  onRecord: (values: RecordStatementLineInput) => void;
  onRemove: () => void;
};

/**
 * What can be done with a statement line nothing in the books matches: book it as
 * a bank fee (money out), as interest or a gateway payout (money in) — each posts
 * the entry and matches the line in one step — or remove a line entered by mistake.
 */
export function StatementLineActions({ line, disabled, onRecord, onRemove }: StatementLineActionsProps) {
  const t = useTranslations("dashBank");
  const locale = useLocale();
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [fee, setFee] = React.useState("");
  const feeValid = fee.trim() === "" || /^\d+$/.test(fee.trim());

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger disabled={disabled} aria-label={t("workspace.lineActions")}>
          <EllipsisVertical aria-hidden className="size-4" />
        </DropdownMenuIconTrigger>
        <DropdownMenuContent>
          {line.amount < 0 ? (
            <DropdownMenuItem onSelect={() => onRecord({ kind: "fee", fee: "" })}>
              <Icon icon={Banknote} size="sm" />
              {t("workspace.recordFee")}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => setPayoutOpen(true)}>
                <Icon icon={Globe} size="sm" />
                {t("workspace.recordPayout")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onRecord({ kind: "interest", fee: "" })}>
                <Icon icon={Percent} size="sm" />
                {t("workspace.recordInterest")}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={onRemove}>
            <Icon icon={Trash2} size="sm" />
            {t("workspace.removeLine")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal open={payoutOpen} onOpenChange={setPayoutOpen}>
        <ModalContent title={t("workspace.payoutTitle")} className="max-w-md">
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!feeValid) return;
              setPayoutOpen(false);
              onRecord({ kind: "gatewayPayout", fee });
            }}
          >
            <p className="text-body-small text-muted-foreground">{t("workspace.payoutDescription", { amount: formatMoney(line.amount, locale) })}</p>
            <label className="flex flex-col gap-1.5 text-body-small-emphasis text-foreground">
              {t("workspace.payoutFee")}
              <Input value={fee} onChange={(event) => setFee(event.target.value)} inputMode="numeric" dir="ltr" aria-invalid={!feeValid} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPayoutOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={!feeValid}>
                {t("workspace.payoutConfirm")}
              </Button>
            </div>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}

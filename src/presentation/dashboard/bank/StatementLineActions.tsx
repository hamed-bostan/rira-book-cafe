"use client";

import { MoreHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import type { RecordStatementLineInput } from "@/src/contracts/bank-schema";
import type { BankStatementLine } from "@/src/domain/entities/BankReconciliation";
import { formatNumber } from "@/src/lib/formatNumber";
import { cn } from "@/src/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuIconTrigger,
  DropdownMenuItem,
} from "@/src/presentation/design-system/components/DropdownMenu/DropdownMenu";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { Spinner } from "@/src/presentation/design-system/components/Spinner/Spinner";

import { DashboardDialog } from "../DashboardDialog";
import { DashboardField } from "../DashboardField";
import { FIELD_INPUT } from "../fieldStyles";
import { AMOUNT_INPUT } from "../pageStyles";

type StatementLineActionsProps = {
  line: BankStatementLine;
  disabled: boolean;
  /** This line's own action is running — the trigger shows the spinner in place of its icon. */
  busy?: boolean;
  onRecord: (values: RecordStatementLineInput) => void;
  onRemove: () => void;
};

/**
 * What can be done with a statement line nothing in the books matches: book it as
 * a bank fee (money out), as interest or a gateway payout (money in) — each posts
 * the entry and matches the line in one step — or remove a line entered by mistake.
 */
export function StatementLineActions({ line, disabled, busy = false, onRecord, onRemove }: StatementLineActionsProps) {
  const t = useTranslations("dashBank");
  const locale = useLocale();
  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [fee, setFee] = React.useState("");
  const feeValid = fee.trim() === "" || /^\d+$/.test(fee.trim());

  return (
    <>
      <DropdownMenu>
        <DropdownMenuIconTrigger
          className="size-11 shrink-0 sm:size-8"
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          aria-label={t("workspace.lineActions")}
        >
          {busy ? <Spinner size="xs" decorative /> : <Icon icon={MoreHorizontal} size="icon-md" />}
        </DropdownMenuIconTrigger>
        <DropdownMenuContent align="end">
          {line.amount < 0 ? (
            <DropdownMenuItem onSelect={() => onRecord({ kind: "fee", fee: "" })}>
              {t("workspace.recordFee")}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => onRecord({ kind: "interest", fee: "" })}>
                {t("workspace.recordInterest")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setPayoutOpen(true)}>{t("workspace.recordPayout")}</DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem destructive onSelect={onRemove}>
            {t("workspace.removeLine")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DashboardDialog
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        title={t("workspace.payoutTitle")}
        subtitle={t("workspace.payoutDescription", { amount: formatNumber(line.amount, locale) })}
        submitLabel={t("workspace.payoutConfirm")}
        backLabel={t("cancel")}
        blocked={!feeValid}
        pending={false}
        onSubmit={() => {
          setPayoutOpen(false);
          onRecord({ kind: "gatewayPayout", fee });
        }}
      >
        <DashboardField label={t("workspace.payoutFee")}>
          <Input
            size="control-md"
            value={fee}
            onChange={(event) => setFee(event.target.value)}
            inputMode="numeric"
            placeholder="0"
            dir="ltr"
            aria-invalid={!feeValid}
            inputClassName={cn(FIELD_INPUT, AMOUNT_INPUT)}
          />
        </DashboardField>
      </DashboardDialog>
    </>
  );
}

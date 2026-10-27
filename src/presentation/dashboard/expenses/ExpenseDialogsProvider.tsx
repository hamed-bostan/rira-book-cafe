"use client";

import * as React from "react";

import type { Supplier } from "@/src/domain/entities/Expense";
import type { Account } from "@/src/domain/entities/Ledger";
import { useRouter } from "@/src/i18n/navigation";

import { PayExpenseDialog, type PayableExpense } from "./PayExpenseDialog";
import { RecordExpenseDialog } from "./RecordExpenseDialog";
import { VoidExpenseDialog } from "./VoidExpenseDialog";

import type { ReactNode } from "react";

type ExpenseDialogsContextValue = {
  openRecord: () => void;
  openPay: (expense: PayableExpense) => void;
  openVoid: (expense: PayableExpense) => void;
};

const ExpenseDialogsContext = React.createContext<ExpenseDialogsContextValue | null>(null);

type ExpenseDialogsProviderProps = {
  /** Accounts an expense can be booked to. */
  accounts: readonly Account[];
  /** Suppliers still bought from. */
  suppliers: readonly Supplier[];
  /** Today on the cafe calendar. */
  today: string;
  /**
   * Open "Record an expense" straight away — the page was reached as
   * `/dashboard/expenses/new`. Closing it clears that from the URL.
   */
  recordOnLoad: boolean;
  children: ReactNode;
};

type DialogState =
  | { kind: "record"; open: boolean; key: number; fromUrl: boolean }
  | { kind: "pay" | "void"; expense: PayableExpense; open: boolean; key: number; fromUrl: false };

/**
 * Holds the Expenses page's dialogs once, for the header and every row to open.
 * Each opening starts a fresh form; closing keeps the dialog mounted until its
 * exit animation has played.
 */
export function ExpenseDialogsProvider({
  accounts,
  suppliers,
  today,
  recordOnLoad,
  children,
}: ExpenseDialogsProviderProps) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<DialogState | null>(
    recordOnLoad ? { kind: "record", open: true, key: 0, fromUrl: true } : null,
  );

  const value = React.useMemo<ExpenseDialogsContextValue>(
    () => ({
      openRecord: () =>
        setDialog((current) => ({ kind: "record", open: true, key: (current?.key ?? 0) + 1, fromUrl: false })),
      openPay: (expense) =>
        setDialog((current) => ({ kind: "pay", expense, open: true, key: (current?.key ?? 0) + 1, fromUrl: false })),
      openVoid: (expense) =>
        setDialog((current) => ({ kind: "void", expense, open: true, key: (current?.key ?? 0) + 1, fromUrl: false })),
    }),
    [],
  );

  const onOpenChange = (open: boolean): void => {
    if (!open && dialog?.fromUrl) router.replace("/dashboard/expenses", { scroll: false });
    setDialog((current) => (current ? { ...current, open, fromUrl: false } : current));
  };

  return (
    <ExpenseDialogsContext.Provider value={value}>
      {children}
      {dialog?.kind === "record" ? (
        <RecordExpenseDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={onOpenChange}
          accounts={accounts}
          suppliers={suppliers}
          today={today}
        />
      ) : dialog?.kind === "pay" ? (
        <PayExpenseDialog
          key={dialog.key}
          open={dialog.open}
          onOpenChange={onOpenChange}
          expense={dialog.expense}
          today={today}
        />
      ) : dialog?.kind === "void" ? (
        <VoidExpenseDialog key={dialog.key} open={dialog.open} onOpenChange={onOpenChange} expense={dialog.expense} />
      ) : null}
    </ExpenseDialogsContext.Provider>
  );
}

/** The opener for the page's expense dialogs; only inside {@link ExpenseDialogsProvider}. */
export function useExpenseDialogs(): ExpenseDialogsContextValue {
  const context = React.useContext(ExpenseDialogsContext);
  if (!context) throw new Error("useExpenseDialogs must be used inside ExpenseDialogsProvider");
  return context;
}

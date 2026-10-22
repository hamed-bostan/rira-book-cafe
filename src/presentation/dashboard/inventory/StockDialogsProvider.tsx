"use client";

import * as React from "react";

import type { StockItem } from "@/src/domain/entities/Inventory";

import { CountStockDialog } from "./CountStockDialog";
import { ReceiveDeliveryDialog } from "./ReceiveDeliveryDialog";
import { ReorderLevelDialog } from "./ReorderLevelDialog";
import { WasteDialog } from "./WasteDialog";

import type { ReactNode } from "react";

export type StockDialogKind = "receive" | "count" | "level" | "waste";

type StockDialogsContextValue = {
  /** Open one of the stock dialogs on an item — the person can still pick another inside it. */
  openDialog: (kind: StockDialogKind, itemId: string) => void;
};

const StockDialogsContext = React.createContext<StockDialogsContextValue | null>(null);

type StockDialogsProviderProps = {
  /** The items the dialogs can act on. */
  items: readonly StockItem[];
  costsVisible: boolean;
  /** Today on the cafe calendar — the date each entry is booked on. */
  today: string;
  children: ReactNode;
};

type DialogState = { kind: StockDialogKind; itemId: string; open: boolean; key: number };

/**
 * Holds the Inventory page's dialogs once, for the header and every row to open.
 * The item list crosses to the client a single time rather than once per row's
 * menu. Each opening starts a fresh form; closing keeps the dialog mounted until
 * its exit animation has played.
 */
export function StockDialogsProvider({ items, costsVisible, today, children }: StockDialogsProviderProps) {
  const [dialog, setDialog] = React.useState<DialogState | null>(null);

  const openDialog = React.useCallback((kind: StockDialogKind, itemId: string): void => {
    setDialog((current) => ({ kind, itemId, open: true, key: (current?.key ?? 0) + 1 }));
  }, []);
  const value = React.useMemo(() => ({ openDialog }), [openDialog]);

  const onOpenChange = (open: boolean): void => setDialog((current) => (current ? { ...current, open } : current));
  const shared = dialog ? { open: dialog.open, onOpenChange, items, initialItemId: dialog.itemId } : undefined;

  return (
    <StockDialogsContext.Provider value={value}>
      {children}
      {dialog && shared ? (
        dialog.kind === "receive" ? (
          <ReceiveDeliveryDialog key={dialog.key} {...shared} costsVisible={costsVisible} today={today} />
        ) : dialog.kind === "count" ? (
          <CountStockDialog key={dialog.key} {...shared} costsVisible={costsVisible} today={today} />
        ) : dialog.kind === "level" ? (
          <ReorderLevelDialog key={dialog.key} {...shared} />
        ) : (
          <WasteDialog key={dialog.key} {...shared} costsVisible={costsVisible} today={today} />
        )
      ) : null}
    </StockDialogsContext.Provider>
  );
}

/** The opener for the page's stock dialogs; only inside {@link StockDialogsProvider}. */
export function useStockDialogs(): StockDialogsContextValue {
  const context = React.useContext(StockDialogsContext);
  if (!context) throw new Error("useStockDialogs must be used inside StockDialogsProvider");
  return context;
}

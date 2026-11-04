"use client";

import * as React from "react";

import type { StockItem } from "@/src/domain/entities/Inventory";

import { AdjustStockDialog } from "./AdjustStockDialog";
import { CountStockDialog } from "./CountStockDialog";
import { ReceiveDeliveryDialog } from "./ReceiveDeliveryDialog";
import { ReorderLevelDialog } from "./ReorderLevelDialog";
import { StockItemDialog } from "./StockItemDialog";
import { WasteDialog } from "./WasteDialog";

import type { ReactNode } from "react";

export type StockDialogKind = "receive" | "count" | "level" | "waste" | "adjust" | "item" | "newItem";

type StockDialogsContextValue = {
  /**
   * Open one of the stock dialogs on an item — the person can still pick another
   * inside it. `newItem` makes one, so it takes no item.
   */
  openDialog: (kind: StockDialogKind, itemId?: string) => void;
};

const StockDialogsContext = React.createContext<StockDialogsContextValue | null>(null);

type StockDialogsProviderProps = {
  /** The items the dialogs can act on. */
  items: readonly StockItem[];
  costsVisible: boolean;
  /** Today on the cafe calendar — the date each entry is booked on. */
  today: string;
  /** Who an item can be bought from — the item dialog's choice. */
  suppliers: readonly { id: string; name: string }[];
  children: ReactNode;
};

type DialogState = { kind: StockDialogKind; itemId: string; open: boolean; key: number };

/**
 * Holds the Inventory page's dialogs once, for the header and every row to open.
 * The item list crosses to the client a single time rather than once per row's
 * menu. Each opening starts a fresh form; closing keeps the dialog mounted until
 * its exit animation has played.
 */
export function StockDialogsProvider({ items, costsVisible, today, suppliers, children }: StockDialogsProviderProps) {
  const [dialog, setDialog] = React.useState<DialogState | null>(null);

  const openDialog = React.useCallback((kind: StockDialogKind, itemId = ""): void => {
    setDialog((current) => ({ kind, itemId, open: true, key: (current?.key ?? 0) + 1 }));
  }, []);
  const value = React.useMemo(() => ({ openDialog }), [openDialog]);

  const onOpenChange = (open: boolean): void => setDialog((current) => (current ? { ...current, open } : current));

  function render(state: DialogState): ReactNode {
    const shared = { open: state.open, onOpenChange, items, initialItemId: state.itemId };
    switch (state.kind) {
      case "receive":
        return <ReceiveDeliveryDialog key={state.key} {...shared} costsVisible={costsVisible} today={today} />;
      case "count":
        return <CountStockDialog key={state.key} {...shared} costsVisible={costsVisible} today={today} />;
      case "level":
        return <ReorderLevelDialog key={state.key} {...shared} />;
      case "waste":
        return <WasteDialog key={state.key} {...shared} costsVisible={costsVisible} today={today} />;
      case "adjust":
        return <AdjustStockDialog key={state.key} {...shared} costsVisible={costsVisible} today={today} />;
      case "item":
      case "newItem":
        return (
          <StockItemDialog
            key={state.key}
            open={state.open}
            onOpenChange={onOpenChange}
            item={state.kind === "item" ? items.find((item) => item.id === state.itemId) : undefined}
            suppliers={suppliers}
          />
        );
    }
  }

  return (
    <StockDialogsContext.Provider value={value}>
      {children}
      {dialog ? render(dialog) : null}
    </StockDialogsContext.Provider>
  );
}

/** The opener for the page's stock dialogs; only inside {@link StockDialogsProvider}. */
export function useStockDialogs(): StockDialogsContextValue {
  const context = React.useContext(StockDialogsContext);
  if (!context) throw new Error("useStockDialogs must be used inside StockDialogsProvider");
  return context;
}

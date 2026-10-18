import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Expense, PaymentSource } from "../entities/Expense";
import type { StockItem, StockMovement, StockMovementKind } from "../entities/Inventory";
import type { NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

/** Goods delivered: what came in, what each line cost before VAT, and how the bill was settled. */
export type StockReceiptInput = {
  date: string;
  supplierId?: string;
  description: string;
  lines: { ingredientId: string; quantity: number; cost: number }[];
  vatAmount: number;
  /** Paid on delivery; omitted means owed to the supplier. */
  paidFrom?: PaymentSource;
  createdById: string;
  createdByName: string;
};

export type WasteInput = { date: string; ingredientId: string; quantity: number; note?: string };
export type StockCountInput = { date: string; lines: { ingredientId: string; counted: number }[]; note?: string };
export type OpeningStockInput = { date: string; lines: { ingredientId: string; quantity: number; cost: number }[] };

/** A stock event's id, date and value — what its journal entry is built from. */
export type StockEvent = { id: string; date: string; value: number; description: string };
export type StockLedgerHook = (event: StockEvent) => NewJournalEntry | null;

export type MovementFilters = { ingredientId?: string; kind?: StockMovementKind; fromDay?: string; toDay?: string };

export type IInventoryRepository = {
  listStock(includeInactive: boolean): Promise<StockItem[]>;
  listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<StockMovement>>;
  setReorderLevel(ingredientId: string, reorderLevel: number | null): Promise<void>;

  /**
   * Receive a delivery: the supplier bill (an expense on Inventory, with its entry),
   * the stock coming in at cost (average cost recomputed), each item's latest
   * purchase price, and the cost price of every recipe using them — one transaction.
   */
  receive(input: StockReceiptInput, ledger: LedgerHook<Expense>, audit?: AuditHook<Expense>): Promise<Expense>;
  /** Take spoiled stock out at average cost, with its entry. */
  recordWaste(input: WasteInput, ledger: StockLedgerHook, actor: { id: string; name: string }): Promise<StockMovement>;
  /** Set stock to what was counted; the total difference is posted once. Returns the signed variance. */
  recordCount(
    input: StockCountInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
  ): Promise<{ id: string; variance: number; adjusted: number }>;
  /** Bring stock already on the shelves into the books. */
  recordOpening(
    input: OpeningStockInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
  ): Promise<{ id: string; value: number }>;
};

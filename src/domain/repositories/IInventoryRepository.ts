import type { AuditHook } from "./AuditHook";
import type { LedgerHook } from "./ILedgerRepository";
import type { Expense, PaymentSource } from "../entities/Expense";
import type {
  AdjustmentReason,
  StockItem,
  StockMovement,
  StockMovementKind,
  SupplierReturn,
} from "../entities/Inventory";
import type { NewJournalEntry } from "../entities/Ledger";
import type { Page, PageRequest } from "../entities/Pagination";

/** Goods delivered: what came in, what each line cost before VAT, and how the bill was settled. */
export type StockReceiptInput = {
  date: string;
  supplierId?: string;
  description: string;
  /** In base units; `note` says how it was typed when that was in packs ("3 bag"). */
  lines: { ingredientId: string; quantity: number; cost: number; note?: string }[];
  vatAmount: number;
  /** Paid on delivery; omitted means owed to the supplier. */
  paidFrom?: PaymentSource;
  createdById: string;
  createdByName: string;
};

export type WasteInput = { date: string; ingredientId: string; quantity: number; note?: string };
export type StockCountInput = { date: string; lines: { ingredientId: string; counted: number }[]; note?: string };
export type OpeningStockInput = { date: string; lines: { ingredientId: string; quantity: number; cost: number }[] };

/** A manual change with its reason: `quantity` is signed (in positive, out negative). */
export type StockAdjustmentInput = {
  date: string;
  ingredientId: string;
  quantity: number;
  reason: AdjustmentReason;
  note?: string;
};

/** Goods going back to a supplier, and the credit note they gave for them. */
export type SupplierReturnInput = {
  date: string;
  supplierId: string;
  /** The delivery the goods came in on; its bill takes the credit first. */
  expenseId?: string;
  lines: { ingredientId: string; quantity: number }[];
  /** The credit note's total, VAT included. */
  creditAmount: number;
  vatAmount: number;
  /** Where any part of the credit the bill can't take comes back to. */
  refundTo?: PaymentSource;
  note?: string;
};

/** A stock event's id, date and value — what its journal entry is built from. */
export type StockEvent = { id: string; date: string; value: number; description: string };
export type StockLedgerHook = (event: StockEvent) => NewJournalEntry | null;

/** One stock item's change, for its activity entry. */
export type StockChange = {
  ingredientId: string;
  ingredientName: string;
  kind: StockMovementKind;
  /** Signed, in the item's unit. */
  quantity: number;
  onHandBefore: number;
  onHandAfter: number;
  /** Signed whole Toman. */
  value: number;
  /** The document it belongs to (count, return, waste…). */
  referenceId: string;
  reason?: AdjustmentReason;
  note?: string;
};

/** What a supplier return books, worked out under the stock rows' locks. */
export type SupplierReturnPosting = {
  id: string;
  number: number;
  date: string;
  supplierName: string;
  applied: number;
  refunded: number;
  refundedTo?: PaymentSource;
  vatAmount: number;
  stockValue: number;
  expenseNumber?: number;
};

export type MovementFilters = {
  ingredientId?: string;
  kind?: StockMovementKind;
  fromDay?: string;
  toDay?: string;
};

/** A book for sale that no stock item stands behind, so its sales book no cost. */
export type UntrackedBook = {
  id: string;
  name: string;
  /** What one copy cost, when it's on the item. */
  costPrice?: number;
  /** Copies on the shelf. */
  stockQuantity: number;
};

/** A delivery goods can go back against, with what's still owed on its bill. */
export type ReturnableDelivery = {
  id: string;
  number: number;
  date: string;
  supplierId: string;
  description: string;
  amount: number;
  /** What's still owed: the part of a credit the bill can take. */
  owed: number;
};

/** How many recent deliveries the return form offers. */
export const MAX_RETURNABLE_DELIVERIES = 100;

/** The most movements one CSV export carries — about a year of a busy cafe. */
export const MAX_MOVEMENT_EXPORT_ROWS = 50_000;

export type IInventoryRepository = {
  listStock(includeInactive: boolean): Promise<StockItem[]>;
  /**
   * Each movement, newest first. Narrowed to one item, every movement carries that
   * item's running on-hand balance (`balanceAfter`) — computed over all its
   * movements, so a kind or date filter doesn't change what the balance says.
   */
  listMovements(filters: MovementFilters, page: PageRequest): Promise<Page<StockMovement>>;
  /** Every movement the filters match, oldest first, up to `MAX_MOVEMENT_EXPORT_ROWS` — for the CSV. */
  exportMovements(filters: MovementFilters): Promise<StockMovement[]>;
  /** What each item had on hand at the end of `day` (see `onHandAtEndOf`). */
  onHandAt(day: string): Promise<Map<string, number>>;
  setReorderLevel(
    ingredientId: string,
    reorderLevel: number | null,
    audit?: AuditHook<{ id: string; name: string; before: number | null; after: number | null }>,
  ): Promise<void>;

  /**
   * Receive a delivery: the supplier bill (an expense on Inventory, with its entry),
   * the stock coming in at cost (average cost recomputed), each item's latest
   * purchase price, and the cost price of every recipe using them — one transaction.
   */
  receive(input: StockReceiptInput, ledger: LedgerHook<Expense>, audit?: AuditHook<Expense>): Promise<Expense>;
  /** Take spoiled stock out at average cost, with its entry. */
  recordWaste(
    input: WasteInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
    audit?: AuditHook<StockChange>,
  ): Promise<StockMovement>;
  /**
   * Set stock to what was counted; the total difference is posted once. A count
   * dated in the past is compared with what was on hand at the end of that day, and
   * the difference applied to today's stock. Returns the signed variance.
   */
  recordCount(
    input: StockCountInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
    audit?: AuditHook<StockChange>,
  ): Promise<{ id: string; variance: number; adjusted: number }>;
  /** A manual ± with its reason, at average cost, with the reason's entry. */
  adjust(
    input: StockAdjustmentInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
    audit?: AuditHook<StockChange>,
  ): Promise<StockMovement>;
  /**
   * Send stock back to a supplier: refuses (`INSUFFICIENT_STOCK`) a line above
   * what's on hand, takes the goods out at average cost, settles the credit against
   * the delivery's bill (its paid amount grows by the part applied) and books the
   * entry — one transaction.
   */
  returnToSupplier(
    input: SupplierReturnInput,
    ledger: (posting: SupplierReturnPosting) => NewJournalEntry,
    actor: { id: string; name: string },
    audit?: AuditHook<StockChange>,
  ): Promise<SupplierReturn>;
  /** Returns, newest first: all, or one supplier's, or one delivery's. */
  listSupplierReturns(filter: { supplierId?: string; expenseId?: string }): Promise<SupplierReturn[]>;
  /** Recent deliveries from a named supplier that aren't void — what a return can be made against. */
  listReturnableDeliveries(): Promise<ReturnableDelivery[]>;
  /** Books for sale with no recipe yet. */
  listUntrackedBooks(): Promise<UntrackedBook[]>;
  /**
   * Give each book a stock item and a one-copy recipe, and bring the copies on the
   * shelf into stock at their cost price, in one transaction.
   */
  trackBooks(
    books: readonly UntrackedBook[],
    date: string,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
  ): Promise<{ tracked: number; value: number }>;
  /**
   * Bring stock already on the shelves into the books. Refuses the whole entry
   * (`STOCK_HAS_HISTORY`, naming the lines) when any of its items has moved before
   * — see `openingLinesRefused`.
   */
  recordOpening(
    input: OpeningStockInput,
    ledger: StockLedgerHook,
    actor: { id: string; name: string },
    audit?: AuditHook<StockChange>,
  ): Promise<{ id: string; value: number }>;
};

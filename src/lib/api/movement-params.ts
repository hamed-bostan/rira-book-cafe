import { isCafeDay } from "@/src/domain/entities/CafeTime";
import { STOCK_MOVEMENT_KINDS, type StockMovementKind } from "@/src/domain/entities/Inventory";
import type { MovementFilters } from "@/src/domain/repositories/IInventoryRepository";

const KINDS = new Set<string>(STOCK_MOVEMENT_KINDS);

/**
 * The stock movements' filters from a query string — `?item=`, `?kind=`,
 * `?from=&to=` (cafe days) — shared by the list and its CSV so the file is always
 * what the screen shows. Anything unrecognised is ignored, not an error.
 */
export function parseMovementFilters(params: URLSearchParams): MovementFilters {
  const filters: MovementFilters = {};
  const item = params.get("item")?.trim();
  if (item) filters.ingredientId = item;
  const kind = params.get("kind");
  if (kind && KINDS.has(kind)) filters.kind = kind as StockMovementKind;
  const from = params.get("from");
  if (from && isCafeDay(from)) filters.fromDay = from;
  const to = params.get("to");
  if (to && isCafeDay(to)) filters.toDay = to;
  return filters;
}

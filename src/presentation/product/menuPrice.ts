import { lowestPrice, optionsChangePrice, type ProductOptionGroup } from "@/src/domain/entities/ProductOptions";

/**
 * The price a menu card shows: the item's own, or — when a choice adds to it — the
 * least it can be ordered for, which the card reads as "from …".
 */
export function menuPrice(item: { price: number; optionGroups?: readonly ProductOptionGroup[] }): {
  amount: number;
  from: boolean;
} {
  return optionsChangePrice(item) ? { amount: lowestPrice(item), from: true } : { amount: item.price, from: false };
}

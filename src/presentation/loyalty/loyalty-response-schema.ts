import { z } from "zod/mini";

import type { OrderQuote } from "@/src/domain/entities/Checkout";
import {
  LOYALTY_REASONS,
  type GuestLoyaltyLookup,
  type GuestLoyaltyOverview,
  type LoyaltySettings,
  type LoyaltyTransaction,
} from "@/src/domain/entities/Loyalty";
import { PROMO_KINDS, type PromoCode, type PromoCodeWithUses } from "@/src/domain/entities/Promotion";

/** What the promotion and loyalty endpoints return, validated at the typed-service boundary. */

export const loyaltySettingsResponseSchema = z.object({
  enabled: z.boolean(),
  tomanPerPoint: z.number(),
  pointValue: z.number(),
  minRedeemPoints: z.number(),
}) satisfies z.ZodMiniType<LoyaltySettings>;

export const loyaltyTransactionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  delta: z.number(),
  reason: z.enum(LOYALTY_REASONS),
  orderId: z.optional(z.string()),
  orderNumber: z.optional(z.number()),
  note: z.optional(z.string()),
  createdByName: z.optional(z.string()),
  createdAt: z.string(),
}) satisfies z.ZodMiniType<LoyaltyTransaction>;

export const guestLoyaltyOverviewResponseSchema = z.object({
  balance: z.number(),
  history: z.array(loyaltyTransactionResponseSchema),
  settings: loyaltySettingsResponseSchema,
}) satisfies z.ZodMiniType<GuestLoyaltyOverview>;

export const guestLoyaltyLookupResponseSchema = z.object({
  userId: z.string(),
  name: z.optional(z.string()),
  balance: z.number(),
  history: z.array(loyaltyTransactionResponseSchema),
}) satisfies z.ZodMiniType<GuestLoyaltyLookup>;

const promoCodeShape = {
  id: z.string(),
  code: z.string(),
  description: z.optional(z.string()),
  kind: z.enum(PROMO_KINDS),
  value: z.number(),
  maxDiscount: z.optional(z.number()),
  minSubtotal: z.number(),
  startsAt: z.optional(z.string()),
  endsAt: z.optional(z.string()),
  usageLimit: z.optional(z.number()),
  perGuestLimit: z.optional(z.number()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const promoCodeResponseSchema = z.object(promoCodeShape) satisfies z.ZodMiniType<PromoCode>;

export const promoCodeListResponseSchema = z.array(
  z.object({ ...promoCodeShape, uses: z.number() }) satisfies z.ZodMiniType<PromoCodeWithUses>,
);

export const orderQuoteResponseSchema = z.object({
  subtotal: z.number(),
  promoCode: z.optional(z.string()),
  promoDiscount: z.number(),
  pointsRedeemed: z.number(),
  pointsDiscount: z.number(),
  total: z.number(),
  pointsBalance: z.number(),
  pointsAvailable: z.number(),
  pointsToEarn: z.number(),
  loyaltyEnabled: z.boolean(),
  pointValue: z.number(),
  minRedeemPoints: z.number(),
}) satisfies z.ZodMiniType<OrderQuote>;

import { z } from "zod";

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
}) satisfies z.ZodType<LoyaltySettings>;

export const loyaltyTransactionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  delta: z.number(),
  reason: z.enum(LOYALTY_REASONS),
  orderId: z.string().optional(),
  orderNumber: z.number().optional(),
  note: z.string().optional(),
  createdByName: z.string().optional(),
  createdAt: z.string(),
}) satisfies z.ZodType<LoyaltyTransaction>;

export const guestLoyaltyOverviewResponseSchema = z.object({
  balance: z.number(),
  history: z.array(loyaltyTransactionResponseSchema),
  settings: loyaltySettingsResponseSchema,
}) satisfies z.ZodType<GuestLoyaltyOverview>;

export const guestLoyaltyLookupResponseSchema = z.object({
  userId: z.string(),
  name: z.string().optional(),
  balance: z.number(),
  history: z.array(loyaltyTransactionResponseSchema),
}) satisfies z.ZodType<GuestLoyaltyLookup>;

const promoCodeShape = {
  id: z.string(),
  code: z.string(),
  description: z.string().optional(),
  kind: z.enum(PROMO_KINDS),
  value: z.number(),
  maxDiscount: z.number().optional(),
  minSubtotal: z.number(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  usageLimit: z.number().optional(),
  perGuestLimit: z.number().optional(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
};

export const promoCodeResponseSchema = z.object(promoCodeShape) satisfies z.ZodType<PromoCode>;

export const promoCodeListResponseSchema = z.array(
  z.object({ ...promoCodeShape, uses: z.number() }) satisfies z.ZodType<PromoCodeWithUses>,
);

export const orderQuoteResponseSchema = z.object({
  subtotal: z.number(),
  promoCode: z.string().optional(),
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
}) satisfies z.ZodType<OrderQuote>;

import { notFound } from "next/navigation";

import { PAYMENT_OUTCOMES, type PaymentOutcome } from "@/src/domain/entities/PaymentAttempt";
import { requireAuth } from "@/src/lib/require-auth";
import { MyOrderScreen } from "@/src/presentation/storefront/orders/MyOrderScreen";
import { storefrontServerApi } from "@/src/presentation/storefront/storefront-server-api";

export const dynamic = "force-dynamic";

type MyOrderPageProps = {
  params: Promise<{ id: string }>;
  /** `?payment=` is set by the payment callback when the guest returns from the gateway. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parsePaymentOutcome(value: string | string[] | undefined): PaymentOutcome | "error" | undefined {
  if (value === "error") return "error";
  return (PAYMENT_OUTCOMES as readonly unknown[]).includes(value) ? (value as PaymentOutcome) : undefined;
}

/** One of the guest's own orders; anyone else's reads as not found. */
export default async function MyOrderPage({ params, searchParams }: MyOrderPageProps) {
  await requireAuth();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await storefrontServerApi.myOrder(id);
  if (!order) notFound();

  return <MyOrderScreen order={order} paymentOutcome={parsePaymentOutcome(query.payment)} />;
}

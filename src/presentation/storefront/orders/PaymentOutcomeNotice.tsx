import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { PaymentOutcome } from "@/src/domain/entities/PaymentAttempt";
import { cn } from "@/src/lib/utils";

const TONE: Record<PaymentOutcome | "error", { icon: typeof CircleCheck; className: string }> = {
  paid: { icon: CircleCheck, className: "border-border bg-surface text-success-foreground" },
  processing: { icon: Clock, className: "border-border bg-surface text-foreground" },
  failed: { icon: CircleAlert, className: "border-error-foreground bg-error text-error-foreground" },
  review: { icon: CircleAlert, className: "border-error-foreground bg-error text-error-foreground" },
  error: { icon: CircleAlert, className: "border-error-foreground bg-error text-error-foreground" },
};

/** How the online payment went, shown when the guest lands back from the gateway. */
export async function PaymentOutcomeNotice({ outcome }: { outcome: PaymentOutcome | "error" }) {
  const t = await getTranslations("site");
  const { icon: IconComponent, className } = TONE[outcome];

  return (
    <p
      role="status"
      className={cn("flex items-start gap-2 rounded-card-md border px-4 py-3 text-body-small", className)}
    >
      <IconComponent className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t(`orders.payOutcome.${outcome}`)}</span>
    </p>
  );
}

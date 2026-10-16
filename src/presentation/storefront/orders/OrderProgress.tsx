import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { OrderStatus } from "@/src/domain/entities/Order";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system";

const STEPS = ["pending", "accepted", "preparing", "ready", "completed"] as const satisfies readonly OrderStatus[];

/** The order's progress as the guest sees it: placed → accepted → preparing → ready → served. */
export async function OrderProgress({ status }: { status: OrderStatus }) {
  const t = await getTranslations("site");
  const current = STEPS.indexOf(status as (typeof STEPS)[number]);

  return (
    <ol className="grid grid-cols-5 gap-1">
      {STEPS.map((step, index) => {
        const done = current >= index;
        return (
          <li key={step} className="flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full border text-body-caption",
                done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
              )}
              aria-hidden
            >
              {done ? <Icon icon={Check} size="xs" /> : index + 1}
            </span>
            <span className={cn("text-body-caption", index === current ? "text-foreground" : "text-muted-foreground")}>
              {t(`orders.step.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

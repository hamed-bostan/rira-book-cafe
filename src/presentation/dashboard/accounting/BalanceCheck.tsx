import { CircleAlert, CircleCheck } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

import { ROW_TEXT } from "../pageStyles";

/** The statement's own arithmetic check, stated rather than assumed. */
export function BalanceCheck({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <p
      role="status"
      className={cn(
        ROW_TEXT,
        "flex items-center gap-2 rounded-card-lg border px-4 py-3 font-medium",
        ok
          ? "border-success-border bg-success text-success-foreground"
          : "border-error-border bg-error text-error-foreground",
      )}
    >
      <Icon icon={ok ? CircleCheck : CircleAlert} size="icon-md" />
      {ok ? okLabel : failLabel}
    </p>
  );
}

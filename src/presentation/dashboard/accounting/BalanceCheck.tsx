import { CircleAlert, CircleCheck } from "lucide-react";

/** The statement's own arithmetic check, stated rather than assumed. */
export function BalanceCheck({ ok, okLabel, failLabel }: { ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <p
      className={
        ok
          ? "flex items-center gap-2 text-body-small text-success-foreground"
          : "flex items-center gap-2 rounded-card-md border border-error-foreground bg-error px-4 py-3 text-body-small text-error-foreground"
      }
    >
      {ok ? <CircleCheck className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
      {ok ? okLabel : failLabel}
    </p>
  );
}

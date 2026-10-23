"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toast } from "radix-ui";

import { cn } from "@/src/lib/utils";

import { Icon } from "../Icon";
import { focusRing } from "../shared/focusRing";

import type { ToastRecord, ToastTone } from "./toastTypes";

const TONE_ICON = { success: CircleCheck, error: CircleAlert, info: Info } as const;

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
};

/** Errors stay up longer: they're the ones a user may need to read twice. */
const DEFAULT_DURATION: Record<ToastTone, number> = { success: 4000, info: 4000, error: 7000 };

/** A toast that can be undone stays a little longer, so there's time to reach the button. */
const UNDO_DURATION = 6000;

type ToastItemProps = {
  toast: ToastRecord;
  onOpenChange: (open: boolean) => void;
};

/** One toast in the stack — icon, title, optional detail, and a close button. */
export function ToastItem({ toast, onOpenChange }: ToastItemProps) {
  const t = useTranslations("ds");
  const tone = toast.tone ?? "info";

  return (
    <Toast.Root
      open={toast.open}
      onOpenChange={onOpenChange}
      duration={toast.duration ?? (toast.onUndo ? UNDO_DURATION : DEFAULT_DURATION[tone])}
      // A failure interrupts (assertive); a confirmation waits its turn (polite).
      type={tone === "error" ? "foreground" : "background"}
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-card-lg border border-border bg-popover p-4 shadow-lg",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        // Arrives from the edge it's docked to (top on phones, bottom from `sm`).
        // Fade only under reduced motion.
        "motion-safe:data-[state=open]:slide-in-from-top-full motion-safe:sm:data-[state=open]:slide-in-from-bottom-full",
        // Swipe-to-dismiss follows the finger, then leaves toward the screen edge.
        "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=move]:transition-none",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
        "data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x)",
        "duration-200",
      )}
    >
      <Icon icon={TONE_ICON[tone]} size="sm" className={cn("mt-0.5", TONE_ICON_CLASS[tone])} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Toast.Title className="text-body-small-strong text-foreground">{toast.title}</Toast.Title>
        {toast.description ? (
          <Toast.Description className="text-body-small text-muted-foreground">{toast.description}</Toast.Description>
        ) : null}
      </div>

      {toast.onUndo ? (
        <Toast.Action
          // A toast leaves on its own, so screen readers are told where else to undo.
          altText={t("undoAlt")}
          onClick={toast.onUndo}
          className={cn(
            "-my-1 inline-flex min-h-11 shrink-0 items-center rounded-button px-2 text-body-small-strong text-primary transition-colors hover:bg-accent sm:min-h-8",
            focusRing,
          )}
        >
          {t("undo")}
        </Toast.Action>
      ) : null}

      <Toast.Close
        aria-label={t("close")}
        className={cn(
          "-me-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-button text-icon-muted transition-colors hover:bg-accent hover:text-primary",
          focusRing,
        )}
      >
        <Icon icon={X} size="xs" />
      </Toast.Close>
    </Toast.Root>
  );
}

"use client";

import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/**
 * Tries a failed part of the overview again. A refresh rather than a client fetch:
 * the page's server render re-runs every read, so the server stays the single
 * source of truth. Busy until the new render has landed.
 */
export function RetryReadButton({ className }: { className?: string }) {
  const t = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      size="control-md"
      loading={pending}
      onClick={() => startTransition(() => router.refresh())}
      className={cn("px-3", className)}
    >
      {/* While busy, the button's spinner takes the icon's place. */}
      {pending ? null : <Icon icon={RotateCcw} size="icon-md" className="me-2" />}
      {t("retry")}
    </Button>
  );
}

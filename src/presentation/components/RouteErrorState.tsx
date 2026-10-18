"use client";

import { CloudOff, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Link } from "@/src/i18n/navigation";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { EmptyState } from "@/src/presentation/design-system/components/EmptyState/EmptyState";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

/** The props Next hands every `error.tsx`. */
export type RouteErrorProps = {
  error: Error & { digest?: string };
  /** Re-fetches and re-renders the segment (unlike `reset`, which only re-renders). */
  retry: () => void;
};

type RouteErrorStateProps = RouteErrorProps & {
  /** What failed, in the screen's own words — "We couldn't load the menu". */
  title?: string;
  description?: string;
  /** A second way out beside the retry, for when retrying isn't going to help. */
  homeHref?: string;
  size?: "section" | "page";
};

/**
 * The body of a route `error.tsx`: says what failed, offers a retry that re-runs
 * the segment's server fetch, and shows the error's digest so a guest reporting
 * it can quote something support can find in the server logs.
 */
export function RouteErrorState({ error, retry, title, description, homeHref, size = "page" }: RouteErrorStateProps) {
  const t = useTranslations("errors");
  // `retry` re-fetches inside a transition; tracking it keeps the button busy
  // until the segment has either rendered or failed again.
  const [pending, startTransition] = React.useTransition();

  return (
    <EmptyState
      size={size}
      tone="error"
      icon={CloudOff}
      title={title ?? t("title")}
      description={
        <>
          {description ?? t("body")}
          {error.digest ? (
            <span className="mt-2 block text-body-caption text-muted-foreground" dir="ltr">
              {t("reference", { digest: error.digest })}
            </span>
          ) : null}
        </>
      }
      action={
        <>
          <Button type="button" size="sm" loading={pending} onClick={() => startTransition(retry)}>
            {!pending && <Icon icon={RotateCcw} size="sm" className="me-1.5" />}
            {t("retry")}
          </Button>
          {homeHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={homeHref}>{t("goHome")}</Link>
            </Button>
          ) : null}
        </>
      }
    />
  );
}

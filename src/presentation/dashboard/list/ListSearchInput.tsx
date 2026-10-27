"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Input } from "@/src/presentation/design-system/components/form/Input/Input";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import { useListParams } from "./useListParams";

/** How long typing must pause before the search navigates. */
const DEBOUNCE_MS = 350;

type ListSearchInputProps = {
  /** Query param the term is written to; `q` for every list so far. */
  paramName?: string;
  placeholder: string;
  /** Accessible name — the input carries no visible label. */
  label: string;
  /** Responsive width or placement overrides supplied by the list using it. */
  className?: string;
};

/**
 * Search box for an admin list. Writes the term into the URL, which re-runs the
 * server render — so it searches the whole table, not just the page on screen.
 *
 * Debounced because each change is a navigation and a database query; firing one
 * per keystroke would queue a request per character and let a slow one land after
 * a newer one. The input keeps its own value meanwhile, so typing stays smooth
 * while the committed term trails behind in the URL.
 */
export function ListSearchInput({ paramName = "q", placeholder, label, className }: ListSearchInputProps) {
  const t = useTranslations("dashList");
  const { searchParams, setFilter } = useListParams();
  const committed = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(committed);

  // Re-sync when the committed term changes from outside this input — a cleared
  // filter, a Back navigation, a pasted link.
  //
  // Adjusted during render rather than in an effect: React re-runs this component
  // before committing, so the input never paints the stale term, and there's no
  // cascading second render. (See "You Might Not Need an Effect" — resetting state
  // when a value changes.)
  const [lastCommitted, setLastCommitted] = useState(committed);
  if (committed !== lastCommitted) {
    setLastCommitted(committed);
    setValue(committed);
  }

  useEffect(() => {
    if (value === committed) return;
    const timer = setTimeout(() => setFilter(paramName, value.trim() || null), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, committed, paramName, setFilter]);

  // Clearing is a decision, not more typing: it navigates at once, skipping the debounce.
  function clear(): void {
    setValue("");
    setFilter(paramName, null);
  }

  return (
    <Input
      type="search"
      size="control-md"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={cn("w-full sm:max-w-xs", className)}
      // The browser's own clear glyph is hidden so there's one ✕, styled like the rest.
      inputClassName="[&::-webkit-search-cancel-button]:appearance-none"
      leftElement={<Icon icon={Search} size="sm" className="text-muted-foreground" />}
      rightElement={
        value ? (
          <button
            type="button"
            aria-label={t("clearSearch")}
            onClick={clear}
            className={cn(
              // A 24px glyph with a 44px touch area on a phone (the pseudo-element),
              // so it's easy to hit without crowding the field.
              "relative flex size-6 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              "after:absolute after:-inset-2.5 sm:after:inset-0",
              focusRing,
            )}
          >
            <Icon icon={X} size="xs" />
          </button>
        ) : undefined
      }
    />
  );
}

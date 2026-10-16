"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Icon, Input } from "@/src/presentation/design-system";

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

  return (
    <Input
      type="search"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className={cn("w-full sm:max-w-xs", className)}
      leftElement={<Icon icon={Search} size="sm" className="text-muted-foreground" />}
    />
  );
}

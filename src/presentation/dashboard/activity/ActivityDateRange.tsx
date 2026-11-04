"use client";

import { useTranslations } from "next-intl";
import * as React from "react";

import { useListParams } from "@/src/presentation/dashboard/list";
import { Button } from "@/src/presentation/design-system/components/Button/Button";

import { CafeDayField } from "./CafeDayField";

/**
 * The log narrowed to a span of days — Tehran days, on the Persian calendar in
 * Persian. Either end can be left open ("everything since…"). A draft with an
 * explicit Apply, so a half-picked day doesn't page through empty results on the
 * way to the one meant. A `from` after `to` is swapped rather than refused.
 */
export function ActivityDateRange() {
  const t = useTranslations("dashActivity");
  const { searchParams, setParams } = useListParams();
  const committedFrom = searchParams.get("from") ?? "";
  const committedTo = searchParams.get("to") ?? "";
  const [from, setFrom] = React.useState(committedFrom);
  const [to, setTo] = React.useState(committedTo);
  const [committed, setCommitted] = React.useState(`${committedFrom}|${committedTo}`);

  // Another control (Clear filters) moved the range: start the draft from it.
  if (committed !== `${committedFrom}|${committedTo}`) {
    setCommitted(`${committedFrom}|${committedTo}`);
    setFrom(committedFrom);
    setTo(committedTo);
  }

  function apply(nextFrom: string, nextTo: string): void {
    const [low, high] = nextFrom && nextTo && nextFrom > nextTo ? [nextTo, nextFrom] : [nextFrom, nextTo];
    const next = new URLSearchParams(searchParams);
    if (low) next.set("from", low);
    else next.delete("from");
    if (high) next.set("to", high);
    else next.delete("to");
    next.delete("page");
    setParams(next);
  }

  const dirty = from !== committedFrom || to !== committedTo;
  const active = committedFrom !== "" || committedTo !== "";

  return (
    <form
      className="col-span-full grid min-w-0 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        apply(from, to);
      }}
    >
      <CafeDayField label={t("filterFrom")} value={from} onChange={setFrom} />
      <CafeDayField label={t("filterTo")} value={to} onChange={setTo} />
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" size="control-md" variant="secondary" className="px-3" disabled={!dirty}>
          {t("applyDates")}
        </Button>
        {active ? (
          <Button
            type="button"
            size="control-md"
            variant="link"
            onClick={() => {
              setFrom("");
              setTo("");
              apply("", "");
            }}
          >
            {t("clearDates")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

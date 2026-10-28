"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import type { KitchenLane } from "@/src/domain/entities/Kitchen";
import { cn } from "@/src/lib/utils";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { ReactNode } from "react";

export type KitchenLaneTab = {
  lane: KitchenLane;
  label: string;
  /** The lane's ticket count, in the reader's digits. */
  count: string;
  /** Whether any ticket in the lane is late — the count turns red. */
  hasLate: boolean;
  /** The lane itself, rendered on the server. */
  content: ReactNode;
};

type KitchenLaneTabsProps = {
  /** Names the switch for assistive tech ("Lanes"). */
  label: string;
  lanes: readonly KitchenLaneTab[];
};

/**
 * The board's two lanes. Below `lg` a phone or a narrow tablet shows one lane at
 * a time behind a full-width "New | Being made" switch, each with its count (red
 * when that lane has late orders); from `lg` both lanes sit side by side and the
 * switch goes away. Both lanes are always rendered — CSS decides what shows — so
 * a refresh never flashes the other lane.
 */
export function KitchenLaneTabs({ label, lanes }: KitchenLaneTabsProps) {
  const [selected, setSelected] = React.useState<string>(lanes[0]?.lane ?? "new");

  return (
    <TabsPrimitive.Root value={selected} onValueChange={setSelected} className="flex flex-col gap-6">
      <TabsPrimitive.List aria-label={label} className="flex rounded-button bg-muted p-0.5 lg:hidden">
        {lanes.map((lane) => (
          <TabsPrimitive.Trigger
            key={lane.lane}
            value={lane.lane}
            className={cn(
              "group flex h-11 flex-1 items-center justify-center gap-2 rounded-button px-3 text-body-default font-medium whitespace-nowrap text-muted-foreground transition-colors sm:h-9 sm:text-body-small",
              "hover:text-foreground data-[state=active]:bg-background data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-xs",
              focusRing,
            )}
          >
            {lane.label}
            <span
              className={cn(
                "inline-flex h-5 min-w-5 items-center justify-center rounded-badge-md px-1.5 text-label-compact leading-4 tabular-nums",
                lane.hasLate
                  ? "bg-error text-error-foreground"
                  : "bg-background text-foreground group-data-[state=active]:bg-muted",
              )}
            >
              {lane.count}
            </span>
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        {lanes.map((lane) => (
          <TabsPrimitive.Content
            key={lane.lane}
            value={lane.lane}
            // Kept mounted: from `lg` the "inactive" lane is on screen too.
            forceMount
            className={cn("min-w-0 rounded-card-lg max-lg:data-[state=inactive]:hidden", focusRing)}
          >
            {lane.content}
          </TabsPrimitive.Content>
        ))}
      </div>
    </TabsPrimitive.Root>
  );
}

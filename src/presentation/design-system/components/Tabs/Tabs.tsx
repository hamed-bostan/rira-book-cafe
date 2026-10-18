"use client";

import { Tabs as TabsPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../shared/focusRing";

/**
 * Segmented tabs built on Radix Tabs. Composable parts:
 *   <Tabs defaultValue="en">
 *     <TabsList>
 *       <TabsTrigger value="en">English</TabsTrigger>
 *       <TabsTrigger value="fa">فارسی</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="en">…</TabsContent>
 *   </Tabs>
 *
 * Radix owns roving-focus keyboard nav and `data-state`; styling keys off it.
 * Pass `forceMount` on the panels to keep inactive ones in the DOM (a form whose
 * fields live in tabs needs this so values and errors survive a tab switch) —
 * Radix leaves them *visible* when forced, so the panel must hide itself with
 * `data-[state=inactive]:hidden`.
 */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex items-center gap-1 rounded-card-lg bg-surface-sunken p-1", className)}
    {...props}
  />
));

TabsList.displayName = "TabsList";

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "rounded-card-md px-4 py-1.5 text-body-small-emphasis text-muted-foreground transition-colors",
      "hover:text-foreground",
      focusRing,
      "data-[state=active]:bg-background data-[state=active]:text-foreground",
      className,
    )}
    {...props}
  />
));

TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    // The incoming panel fades in rather than snapping, so switching tabs reads
    // as a change of view. Opacity only, so it stays under reduced motion.
    className={cn(
      focusRing,
      "data-[state=active]:duration-200 data-[state=active]:animate-in data-[state=active]:fade-in-0",
      className,
    )}
    {...props}
  />
));

TabsContent.displayName = "TabsContent";

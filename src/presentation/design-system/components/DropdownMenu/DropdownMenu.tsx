"use client";

import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

import { buttonVariants } from "../Button/Button";
import { focusRing } from "../shared/focusRing";

/**
 * A menu of actions, anchored to the control that opened it. Composable parts:
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><Button …/></DropdownMenuTrigger>
 *     <DropdownMenuContent>
 *       <DropdownMenuItem onSelect={…}>…</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *       <DropdownMenuSub>…</DropdownMenuSub>
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 *
 * Distinct from {@link Popover}, and the distinction is not decorative: a menu is
 * a list of *commands*, so it takes roving focus, types-to-select, and closes on
 * choosing one — behaviour Radix gives a menu and deliberately doesn't give a
 * popover. A panel of filter controls is a popover; a list of things to do is
 * this. Using the wrong one is how a row of options ends up unreachable by
 * keyboard.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;

/** Shared by the menu panel and any submenu panel, so the two are indistinguishable. */
const menuPanel = [
  "z-50 min-w-44 rounded-card-lg border border-border bg-popover p-1 shadow-lg",
  "focus:outline-none",
  "max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto",
  "data-[state=open]:animate-in data-[state=open]:fade-in-0",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
  "motion-safe:data-[state=open]:zoom-in-95 motion-safe:data-[state=closed]:zoom-out-95",
  "duration-150",
];

/** Shared by items and the submenu trigger, so a nested menu opens from a row that matches. */
const menuItem = [
  "flex min-h-11 cursor-pointer select-none items-center gap-2 rounded-button px-2 py-2 dashboard-landscape:min-h-10 xl:min-h-10",
  // Use a readable 16px label on touch layouts without making every command
  // compete with primary actions. Reduce only the size at the denser dashboard
  // breakpoints; both scales retain the same medium emphasis. The menu is
  // portalled, so viewport variants are required here.
  "text-body-emphasis text-foreground outline-none transition-colors dashboard-landscape:text-body-small-emphasis xl:text-body-small-emphasis",
  "data-[highlighted]:bg-accent data-[highlighted]:text-primary",
  "data-[disabled]:pointer-events-none data-[disabled]:text-disabled-foreground",
];

export type DropdownMenuContentProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>;

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "end", sideOffset = 6, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(menuPanel, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  ),
);

DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps extends React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {
  /** Draws the item as a destructive action (cancel, refund). */
  destructive?: boolean;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, destructive, ...props }, ref) => (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(
        menuItem,
        // Colour is the *only* thing that changes: a destructive item stays an
        // ordinary item to a screen reader, and what makes it safe is the
        // confirmation it opens, not how red it is.
        destructive && "text-error-foreground data-[highlighted]:text-error-foreground",
        className,
      )}
      {...props}
    />
  ),
);

DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger ref={ref} className={cn(menuItem, className)} {...props} />
));

DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(menuPanel, className)}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));

DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));

DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export type DropdownMenuIconTriggerAppearance = "ghost" | "secondary";

const ICON_TRIGGER_APPEARANCE: Record<DropdownMenuIconTriggerAppearance, string> = {
  ghost: "size-8 text-icon-muted transition-colors hover:bg-accent hover:text-primary",
  // The dashboard rows' "⋯" is the secondary icon button, not a look of its own:
  // the same hairline square as the row's other buttons (Categories' up/down),
  // 44px to the touch on a phone, 36px from `sm`.
  secondary: cn(buttonVariants({ variant: "secondary", iconOnly: true }), "size-11 sm:size-9"),
};

export type DropdownMenuIconTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  /** `ghost` (a bare 32px icon) by default; `secondary` for a dashboard list row's "⋯". */
  appearance?: DropdownMenuIconTriggerAppearance;
};

/**
 * The square icon button a row's menu hangs off. Here rather than at the call
 * site because every list that grows a row menu needs the same
 * touch-target-sized, label-carrying button, and an icon-only control with no
 * accessible name is the defect that would otherwise be copied along with it.
 */
export const DropdownMenuIconTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuIconTriggerProps>(
  ({ className, appearance = "ghost", ...props }, ref) => (
    <DropdownMenuPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-button",
        focusRing,
        ICON_TRIGGER_APPEARANCE[appearance],
        className,
      )}
      {...props}
    />
  ),
);

DropdownMenuIconTrigger.displayName = "DropdownMenuIconTrigger";

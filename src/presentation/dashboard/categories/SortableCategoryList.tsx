"use client";

import { GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useRouter } from "@/src/i18n/navigation";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { useToast } from "@/src/presentation/design-system/components/Toast/useToast";

import { categoriesApi } from "./category-api";

/** One draggable entry: the category, and what's drawn for it (its row, and a parent's subcategories). */
export type SortableCategory = {
  id: string;
  name: string;
  content: React.ReactNode;
};

type SortableCategoryListProps = {
  /** Whose categories these are: `null` for the top-level ones, else the parent's id. */
  parentId: string | null;
  items: SortableCategory[];
  /** The list's accessible name. */
  label: string;
  /** Turn dragging off (the viewer can't change the menu). */
  disabled?: boolean;
  className?: string;
};

/** Where a drag started: what's moving and the order to go back to if it's called off. */
type Lift = { id: string; from: readonly string[]; via: "pointer" | "keyboard" };

/**
 * A parent's categories (or the top-level ones) in menu order, each with a grip
 * that drags it to a new place among its siblings — never into another parent;
 * that's the edit form's parent field.
 *
 * Mouse, pen and touch drag the grip; the keyboard lifts with Space or Enter,
 * moves with the arrow keys, drops with Space or Enter and calls it off with
 * Escape, every step read out by a live region. On drop, the whole order goes to
 * the server in one request and the page `router.refresh()`es.
 *
 * The list's order while a drag is in flight (and until the refreshed page
 * arrives) is the only client state: it resets to the server's order whenever the
 * server's order changes, as `BulkSelectionProvider` does with its selection.
 *
 * Hand-rolled rather than a drag-and-drop library: the repo has none, and a
 * vertical list reordered by one handle needs pointer capture, midpoints and a
 * live region — a few dozen lines, not a dependency.
 */
export function SortableCategoryList({
  parentId,
  items,
  label,
  disabled = false,
  className,
}: SortableCategoryListProps) {
  const t = useTranslations("dashCategories");
  const tApiErrors = useTranslations("apiErrors");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const serverOrder = React.useMemo(() => items.map((item) => item.id), [items]);
  const serverKey = serverOrder.join(",");
  const [order, setOrder] = React.useState<readonly string[]>(serverOrder);
  const [orderKey, setOrderKey] = React.useState(serverKey);
  if (orderKey !== serverKey) {
    setOrderKey(serverKey);
    setOrder(serverOrder);
  }

  const [lift, setLift] = React.useState<Lift | null>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const listRef = React.useRef<HTMLOListElement>(null);
  const handles = React.useRef(new Map<string, HTMLButtonElement>());
  const instructionsId = React.useId();

  const byId = new Map(items.map((item) => [item.id, item]));
  const nameOf = (id: string): string => byId.get(id)?.name ?? "";
  const placeOf = (ids: readonly string[], id: string): number => ids.indexOf(id) + 1;

  // Reordering the list moves the lifted row's DOM node, which can drop focus:
  // keep it on the grip being moved by keyboard.
  React.useLayoutEffect(() => {
    if (lift?.via !== "keyboard") return;
    const handle = handles.current.get(lift.id);
    if (handle && document.activeElement !== handle) handle.focus();
  }, [order, lift]);

  function moveTo(ids: readonly string[], id: string, index: number): readonly string[] {
    const without = ids.filter((candidate) => candidate !== id);
    const clamped = Math.max(0, Math.min(without.length, index));
    return [...without.slice(0, clamped), id, ...without.slice(clamped)];
  }

  function save(from: readonly string[], to: readonly string[], id: string): void {
    if (from.join(",") === to.join(",")) return;
    startTransition(async () => {
      try {
        await categoriesApi.reorder({ parentId, ids: [...to] });
        toast({ tone: "success", title: t("reorderedToast", { name: nameOf(id), position: placeOf(to, id) }) });
      } catch (err) {
        setOrder(from);
        toast({ tone: "error", title: localizeApiError(err, tApiErrors, t("reorderError")) });
      }
      router.refresh();
    });
  }

  function drop(): void {
    if (!lift) return;
    setLift(null);
    setAnnouncement(
      t("dragDropped", { name: nameOf(lift.id), position: placeOf(order, lift.id), count: order.length }),
    );
    save(lift.from, order, lift.id);
  }

  function cancel(): void {
    if (!lift) return;
    setLift(null);
    setOrder(lift.from);
    setAnnouncement(t("dragCancelled", { name: nameOf(lift.id), position: placeOf(lift.from, lift.id) }));
  }

  // ── Pointer: drag the grip; the row takes the place whose midpoint the pointer passed.
  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>, id: string): void {
    if (disabled || pending || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setLift({ id, from: order, via: "pointer" });
    setAnnouncement(t("dragPickedUp", { name: nameOf(id), position: placeOf(order, id), count: order.length }));
  }

  function onPointerMove(event: React.PointerEvent<HTMLButtonElement>): void {
    if (lift?.via !== "pointer" || !listRef.current) return;
    const rows = Array.from(listRef.current.children) as HTMLElement[];
    let index = 0;
    for (const row of rows) {
      if (row.dataset.id === lift.id) continue;
      const box = row.getBoundingClientRect();
      if (event.clientY > box.top + box.height / 2) index++;
    }
    const next = moveTo(order, lift.id, index);
    if (next.join(",") !== order.join(",")) setOrder(next);
  }

  // ── Keyboard: lift, move with the arrows, drop or call it off.
  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, id: string): void {
    if (disabled || pending) return;
    const lifted = lift?.id === id && lift.via === "keyboard";
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      if (lifted) drop();
      else {
        setLift({ id, from: order, via: "keyboard" });
        setAnnouncement(t("dragPickedUp", { name: nameOf(id), position: placeOf(order, id), count: order.length }));
      }
      return;
    }
    if (!lifted) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = moveTo(order, id, order.indexOf(id) + step);
    setOrder(next);
    setAnnouncement(t("dragMoved", { name: nameOf(id), position: placeOf(next, id), count: next.length }));
  }

  return (
    <>
      <ol ref={listRef} aria-label={label} className={className}>
        {order.map((id, index) => {
          const item = byId.get(id);
          if (!item) return null;
          const lifted = lift?.id === id;
          return (
            <li
              key={id}
              data-id={id}
              className={cn(
                "relative flex items-start bg-background",
                index > 0 && "border-t border-border",
                lifted && "z-10 shadow-sheet ring-2 ring-primary",
              )}
            >
              {disabled ? null : (
                <Button
                  ref={(node) => {
                    if (node) handles.current.set(id, node);
                    else handles.current.delete(id);
                  }}
                  type="button"
                  variant="ghost"
                  size="control-md"
                  iconOnly
                  aria-label={t("dragHandleAria", { name: item.name })}
                  aria-describedby={instructionsId}
                  aria-pressed={lifted && lift?.via === "keyboard"}
                  disabled={pending}
                  // `touch-none` keeps a finger on the grip from scrolling the page instead.
                  className={cn(
                    "ms-1 mt-2.5 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground sm:mt-3",
                    lifted && "cursor-grabbing text-primary",
                  )}
                  onPointerDown={(event) => onPointerDown(event, id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={() => lift?.via === "pointer" && drop()}
                  onPointerCancel={() => lift?.via === "pointer" && cancel()}
                  onKeyDown={(event) => onKeyDown(event, id)}
                >
                  <Icon icon={GripVertical} size="sm" className="sm:size-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">{item.content}</div>
            </li>
          );
        })}
      </ol>
      <p id={instructionsId} className="sr-only">
        {t("dragInstructions")}
      </p>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
    </>
  );
}

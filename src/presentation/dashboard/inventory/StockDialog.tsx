"use client";

import { Link } from "@/src/i18n/navigation";

import { DashboardDialog } from "../DashboardDialog";

import type { ReactNode } from "react";

type StockDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** One line under the title saying what saving does. */
  subtitle: string;
  submitLabel: string;
  /** Nothing to save yet, or something's wrong — the save button waits. */
  blocked: boolean;
  pending: boolean;
  onSubmit: () => void;
  /** What saving will do to the stock, worked out as you type. */
  preview?: string;
  error?: string | null;
  /** A way to the full form, for what this quick one doesn't cover. */
  fullForm?: { prompt: string; label: string; href: string };
  children: ReactNode;
};

/**
 * The frame every Inventory dialog shares — the dashboard's dialog, plus a way to
 * the full form for what a quick one doesn't cover — so receiving, counting,
 * re-levelling and writing off read the same.
 */
export function StockDialog({ fullForm, ...props }: StockDialogProps) {
  return (
    <DashboardDialog
      {...props}
      aside={
        fullForm ? (
          <p className="text-body-small text-muted-foreground sm:text-body-caption">
            {fullForm.prompt}{" "}
            <Link
              href={fullForm.href}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
            >
              {fullForm.label}
            </Link>
          </p>
        ) : undefined
      }
    />
  );
}

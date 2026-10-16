"use client";

import { useTranslations } from "next-intl";
import React, { useEffect, useRef } from "react";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../../shared/focusRing";
import { baseFieldStyles } from "../shared/baseFieldStyles";

type OTPInputProps = {
  length?: number;
  /** Controlled value. Omit for uncontrolled — the component tracks its own digits. */
  value?: string;
  onChange?: (code: string) => void;
  /** Move focus to the first cell on mount. Off by default to avoid stealing focus. */
  autoFocus?: boolean;
  /** Applied to the group container, so a `Field` (or label) can reference it. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Description / error association (e.g. from `Field`) — placed on each cell. */
  "aria-describedby"?: string;
  /** Marks the field invalid: applied to every cell and drives the error styling. */
  "aria-invalid"?: boolean;
};

/** Pads/truncates a value into fixed-length cells, preserving empty positions. */
const toCells = (value: string | undefined, length: number) =>
  Array.from({ length }, (_, i) => value?.[i] ?? "");

export function OTPInput({
  length = 4,
  value,
  onChange,
  autoFocus = false,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: OTPInputProps) {
  const t = useTranslations("ds");
  const groupLabel = ariaLabel ?? t("otpLabel");
  // The cells array is the source of truth. A joined string can't represent an
  // empty *middle* cell (["1","","3"].join() === "13"), so re-deriving cells from
  // a string every render shifts digits left when a middle box is cleared. When
  // controlled, we re-sync from `value` only when it changes externally (e.g. a
  // parent reset), not when it merely echoes our own last emit.
  const [cells, setCells] = React.useState<string[]>(() => toCells(value, length));
  const [lastValue, setLastValue] = React.useState(value);

  const refs = useRef<Array<HTMLInputElement | null>>([]);

  // Sync from a controlled `value` only when it changes externally (not when it
  // echoes our own emit). Reconciled during render — React's "adjusting state on
  // a prop change" pattern — to avoid a cascading setState-in-effect.
  if (value !== undefined && value !== lastValue) {
    setLastValue(value);
    if (value !== cells.join("")) setCells(toCells(value, length));
  }

  const commit = (next: string[]) => {
    setCells(next);
    onChange?.(next.join(""));
  };

  const updateValue = (i: number, v: string) => {
    if (!/^[0-9]?$/.test(v)) return;

    const next = [...cells];
    next[i] = v;
    commit(next);

    if (v && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();

      if (cells[i]) updateValue(i, "");
      else if (i > 0) refs.current[i - 1]?.focus();
      return;
    }

    if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    }

    if (e.key === "ArrowRight" && i < length - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").slice(0, length);

    if (!/^\d+$/.test(pasted)) return;

    const next = [...cells];
    pasted.split("").forEach((digit, idx) => {
      next[idx] = digit;
    });

    commit(next);

    const nextIndex = Math.min(pasted.length, length - 1);
    refs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  return (
    <div
      id={id}
      onPaste={handlePaste}
      className="flex gap-6"
      role="group"
      aria-label={ariaLabelledBy ? undefined : groupLabel}
      aria-labelledby={ariaLabelledBy}
    >
      {cells.map((v, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          maxLength={1}
          value={v}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={t("otpDigit", { index: i + 1, length })}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid || undefined}
          onChange={(e) => updateValue(i, e.target.value)}
          onFocus={(e) => e.target.setSelectionRange(1, 1)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            baseFieldStyles(),
            "size-12 text-center text-2xl",
            "transition-all duration-200",
            // The active cell highlights on plain `:focus`, so it also shows when
            // auto-advancing moves focus after a tap — `focusRing` is
            // `focus-visible`, which pointer input deliberately doesn't match.
            "focus:border-ring",
            focusRing,
          )}
        />
      ))}
    </div>
  );
}

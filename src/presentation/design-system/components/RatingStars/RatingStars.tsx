"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/src/lib/utils";

import { focusRing } from "../shared/focusRing";
import { stillWhenReduced } from "../shared/motion";

/** Amber used for stars across the app (the `rating` design token). */
const STAR_COLOR_CLASS = "text-rating";

const starSizes = {
  sm: "size-5",
  md: "size-8",
  lg: "size-10",
} as const;

export type RatingStarsProps = {
  /** Current rating, 0–`max`. */
  value: number;
  /** Total number of stars. */
  max?: number;
  /** When provided, the stars become an interactive rating picker. */
  onChange?: (value: number) => void;
  /** Star size. */
  size?: keyof typeof starSizes;
  /** Accessible name for the interactive group (e.g. "Your rating"). */
  label?: string;
  className?: string;
};

/**
 * A row of `max` stars. Read-only by default; pass `onChange` to turn it into an
 * interactive rating picker.
 *
 * The interactive form is a real Radix RadioGroup, not hand-rolled `role="radio"`
 * buttons: the ARIA radio pattern requires the group to be a *single* tab stop
 * with arrow keys moving the selection, which Radix's roving tabindex provides.
 */
export function RatingStars({ value, max = 5, onChange, size = "md", label, className }: RatingStarsProps) {
  const t = useTranslations("ds");
  const groupLabel = label ?? t("ratingLabel");
  const stars = Array.from({ length: max }, (_, index) => index + 1);

  const star = (filled: boolean) => (
    <Star
      aria-hidden
      strokeWidth={1.5}
      className={cn(starSizes[size], STAR_COLOR_CLASS, filled ? "fill-rating" : "fill-transparent")}
    />
  );

  if (!onChange) {
    return (
      <div className={cn("flex items-center gap-1", className)} role="img" aria-label={t("ratingValue", { value, max })}>
        {stars.map((starValue) => (
          <span key={starValue}>{star(starValue <= value)}</span>
        ))}
      </div>
    );
  }

  return (
    <RadioGroupPrimitive.Root
      className={cn("flex items-center gap-2", className)}
      aria-label={groupLabel}
      // Radix speaks strings; the public API stays numeric.
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
    >
      {stars.map((starValue) => (
        <RadioGroupPrimitive.Item
          key={starValue}
          value={String(starValue)}
          aria-label={t("ratingStar", { count: starValue })}
          className={cn(
            "cursor-pointer rounded-full transition-transform",
            // The press-shrink is decorative feedback, so it goes entirely rather
            // than just arriving instantly.
            "motion-safe:active:scale-90",
            stillWhenReduced,
            focusRing,
          )}
        >
          {star(starValue <= value)}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}

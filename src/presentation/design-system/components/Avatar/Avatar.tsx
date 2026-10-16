import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/src/lib/utils";

const avatarVariants = cva("flex shrink-0 items-center justify-center overflow-hidden rounded-full", {
  variants: {
    /**
     * `accent` — the tinted circle behind initials, which reads as a deliberate
     * stand-in for a photo rather than a missing one. The default.
     * `surface` — neutral, for a real photo or a generic person icon.
     *
     * Only visible when there is no image: a photo covers the whole circle.
     */
    tone: {
      accent: "bg-accent text-accent-foreground",
      surface: "bg-surface",
    },
  },

  defaultVariants: { tone: "accent" },
});

/** Two leading initials, e.g. "Leonardo DiCaprio" → "LD". */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof avatarVariants> {
  /** The person's name, used to derive the initials shown when there's no image. */
  name?: string;
  /**
   * Shown instead of initials when there's no image — a generic person icon for
   * places where no name is known, or a spinner while one uploads.
   */
  fallback?: React.ReactNode;
  /**
   * The avatar image. Pass it conditionally (`{url && <Image …/>}`) — anything
   * falsy falls through to `fallback`, then to the initials.
   */
  children?: React.ReactNode;
}

/**
 * A person's circular portrait, with a graceful degradation built in: the image
 * if there is one, otherwise a caller-supplied icon, otherwise their initials.
 *
 * The initials are `aria-hidden`. An avatar in this app always sits beside the
 * name it belongs to, so announcing "L D" before reading that name out loud adds
 * nothing but noise.
 *
 * Like `<Thumbnail>`, it carries no size of its own — pass `size-10`, `size-24`
 * through `className`, written out so the Tailwind scanner can see it.
 */
export const Avatar = ({ name, fallback, tone, className, children, ...props }: AvatarProps) => {
  // Deliberately `||` rather than `??`: the idiomatic call site is
  // `{url && <Image/>}`, which yields `false` — not `undefined` — when absent.
  const content = children || fallback || (
    <span aria-hidden className="text-body-small-strong">
      {name ? getInitials(name) : null}
    </span>
  );

  return (
    <span className={cn(avatarVariants({ tone }), className)} {...props}>
      {content}
    </span>
  );
};

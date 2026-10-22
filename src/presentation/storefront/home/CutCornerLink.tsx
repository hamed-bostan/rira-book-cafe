import { ArrowRight } from "lucide-react";

import { Link } from "@/src/i18n/navigation";
import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { focusRing } from "@/src/presentation/design-system/components/shared/focusRing";

import type { ReactNode } from "react";

type CutCornerLinkProps = {
  href: string;
  children: ReactNode;
  /**
   * `solid` is the green call to action; `outline` is its quieter twin, drawn as a
   * green frame around a band-coloured fill, so it only sits on the landing band.
   */
  variant?: "solid" | "outline";
  /** `large` is the hero's oversized action. */
  size?: "default" | "large";
};

/**
 * The landing page's action: a squared button with its corner cut like the logo,
 * trailed by an arrow. The cut is clipped on an inner span so the focus ring on the
 * link itself stays whole.
 */
export function CutCornerLink({ href, children, variant = "solid", size = "default" }: CutCornerLinkProps) {
  const label = (
    <>
      {children}
      <Icon icon={ArrowRight} size="sm" className="rtl:-scale-x-100" />
    </>
  );

  if (variant === "outline") {
    return (
      <Link href={href} className={cn("group inline-flex rounded-sm text-landing-primary", focusRing)}>
        <span className="cut-corner-sm flex rounded-sm bg-landing-primary p-0.5 transition-colors">
          <span className="cut-corner-sm flex items-center gap-3 rounded-xs bg-landing-band px-7.5 py-2.5 text-button-default transition-colors group-hover:bg-landing-primary group-hover:text-landing-on-primary">
            {label}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className={cn("group inline-flex rounded-sm", focusRing)}>
      <span
        className={cn(
          "cut-corner-sm flex items-center rounded-sm bg-landing-primary px-8 text-landing-on-primary transition-colors group-hover:bg-landing-primary-hover",
          size === "large" ? "gap-4 py-4 text-body-lead" : "gap-3 py-3 text-button-default",
        )}
      >
        {label}
      </span>
    </Link>
  );
}

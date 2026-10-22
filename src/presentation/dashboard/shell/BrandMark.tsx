import Image from "next/image";

import { cn } from "@/src/lib/utils";
import logoMark from "@/src/shared/images/brand/logo-mark.png";

/** The tallest the mark is drawn (the site headers); the dashboard rail draws it smaller. */
const MARK_HEIGHT = 40;

type BrandMarkProps = {
  /** Size overrides — set the height; the width follows the mark's tall shape. */
  className?: string;
};

/**
 * Rira's mark: the tall wordmark with the bird. Always sits beside the written
 * name, so it's decorative (empty alt). Sized for its largest use, so the
 * optimizer's 1x/2x pair stays sharp wherever it's drawn smaller.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <Image
      src={logoMark}
      alt=""
      height={MARK_HEIGHT}
      width={Math.round((MARK_HEIGHT * logoMark.width) / logoMark.height)}
      className={cn("h-10 w-auto shrink-0", className)}
    />
  );
}

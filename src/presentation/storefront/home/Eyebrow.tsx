import type { ReactNode } from "react";

type EyebrowProps = {
  children: ReactNode;
};

/** The small, widely tracked label that opens each landing section. */
export function Eyebrow({ children }: EyebrowProps) {
  return <p className="text-body-caption-emphasis tracking-[0.25em] text-landing-accent uppercase">{children}</p>;
}

import Image from "next/image";

type ExpenseReceiptImageProps = {
  src: string;
  alt: string;
  /** Says it opens at full size, in a new tab. */
  openLabel: string;
};

/**
 * A receipt, whole rather than cropped, opening at full size. Never optimized:
 * `/uploads` only serves it to `accounting.view`, and `/_next/image` would keep a
 * copy in a cache that doesn't check who's asking.
 */
export function ExpenseReceiptImage({ src, alt, openLabel }: ExpenseReceiptImageProps) {
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      aria-label={openLabel}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-button border border-border bg-muted"
    >
      <Image src={src} alt={alt} fill unoptimized className="object-contain" />
    </a>
  );
}

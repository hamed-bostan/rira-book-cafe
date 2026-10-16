import Image from "next/image";

import { Thumbnail } from "@/src/presentation/design-system";

type ProductThumbnailSize = "compact" | "table" | "card" | "responsive";

const sizeStyles: Record<ProductThumbnailSize, string> = {
  compact: "size-10 p-1",
  table: "size-11 p-1",
  card: "size-14 p-1.5",
  responsive: "size-12 p-1.5 sm:size-10 sm:p-1",
};

type ProductThumbnailProps = {
  src: string;
  size?: ProductThumbnailSize;
};

/** A padded product-art well; product illustrations are contained, never cropped. */
export function ProductThumbnail({ src, size = "compact" }: ProductThumbnailProps) {
  return (
    <Thumbnail as="span" className={sizeStyles[size]}>
      <Image src={src} alt="" width={56} height={56} className="size-full object-contain" />
    </Thumbnail>
  );
}

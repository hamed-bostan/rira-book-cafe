import { ImageIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/src/lib/utils";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";

type DashboardPhotoPreviewProps = {
  src?: string;
  alt: string;
  /** Says there's nothing here yet. */
  emptyLabel: string;
  /** 4:3 for a menu item's photo, 16:9 for an event's cover. */
  ratio: "photo" | "video";
};

const RATIO: Record<DashboardPhotoPreviewProps["ratio"], string> = {
  photo: "aspect-[4/3]",
  video: "aspect-video",
};

/** A form's uploaded image at the width of its column, or a dashed well until there is one. */
export function DashboardPhotoPreview({ src, alt, emptyLabel, ratio }: DashboardPhotoPreviewProps) {
  if (src) {
    return (
      <div className={cn("relative w-full overflow-hidden rounded-button border border-border bg-muted", RATIO[ratio])}>
        <Image src={src} alt={alt} fill sizes="(min-width: 64rem) 33vw, 100vw" className="object-cover" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-button border-2 border-dashed border-border-strong bg-muted p-4 text-center text-muted-foreground",
        RATIO[ratio],
      )}
    >
      <Icon icon={ImageIcon} size="icon-lg" />
      <span>{emptyLabel}</span>
    </div>
  );
}

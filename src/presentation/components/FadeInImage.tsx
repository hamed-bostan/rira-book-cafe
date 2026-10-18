"use client";

import Image, { type ImageProps } from "next/image";

import { cn } from "@/src/lib/utils";

/** Flags the element so the `.fade-in-image` rule (globals.css) lets it show. */
function markLoaded(img: HTMLImageElement): void {
  img.dataset.loaded = "";
}

/**
 * `next/image` that fades in once the file has arrived, instead of painting in
 * strips over its placeholder well. The fade is pure CSS keyed off a
 * `data-loaded` attribute set straight on the element, so loading an image
 * never re-renders anything.
 *
 * An image that finished before hydration (cached, or server-rendered and fast)
 * fires `load` before React is listening — the ref catches that case. A failed
 * load is marked too, so a broken image never stays invisible.
 *
 * A `preload` image is the page's hero and likely its LCP element: it paints
 * straight away, since a fade would only delay the largest paint.
 */
export function FadeInImage({ className, onLoad, onError, alt, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      ref={(img) => {
        if (img?.complete) markLoaded(img);
      }}
      // `priority` is the deprecated spelling of `preload`; either marks a hero.
      className={cn(!(props.preload || props.priority) && "fade-in-image", className)}
      onLoad={(event) => {
        markLoaded(event.currentTarget);
        onLoad?.(event);
      }}
      onError={(event) => {
        markLoaded(event.currentTarget);
        onError?.(event);
      }}
    />
  );
}

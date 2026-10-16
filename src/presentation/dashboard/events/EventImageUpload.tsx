"use client";

import { ImagePlus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button, FormMessage, Icon, Thumbnail } from "@/src/presentation/design-system";
import { imagesApi } from "@/src/presentation/images/image-api";

type EventImageUploadProps = {
  value?: string;
  onChange: (url: string) => void;
  id?: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/** Event cover upload into the `events` folder; reports the stored URL. Optional — an event can go without one. */
export function EventImageUpload({ value, onChange, id }: EventImageUploadProps) {
  const t = useTranslations("dashEvents");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-selected after an error
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      onChange(await imagesApi.upload(file, "events"));
    } catch (err) {
      console.error("Image upload failed:", err);
      setError(t("uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Thumbnail radius="lg" className="size-20">
        {value ? (
          <Image src={value} alt={t("imagePreviewAlt")} width={80} height={80} className="size-full object-cover" />
        ) : (
          <Icon icon={ImagePlus} size="md" className="text-icon-muted" />
        )}
      </Thumbnail>
      <div className="flex flex-col items-start gap-1.5">
        <input ref={inputRef} id={id} type="file" accept={ACCEPT} className="sr-only" onChange={handleFile} />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? t("uploading") : value ? t("replaceImage") : t("uploadImage")}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
              {t("removeImage")}
            </Button>
          ) : null}
        </div>
        {error ? <FormMessage>{error}</FormMessage> : <FormMessage tone="hint">{t("uploadHint")}</FormMessage>}
      </div>
    </div>
  );
}

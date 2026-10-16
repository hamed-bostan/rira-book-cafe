"use client";

import { ImagePlus } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Button, FormMessage, Icon, Thumbnail } from "@/src/presentation/design-system";
import { imagesApi } from "@/src/presentation/images/image-api";

type IconUploadProps = {
  value?: string;
  onChange: (url: string) => void;
  /** A11y wiring forwarded from the surrounding <Field>. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/**
 * Category icon picker: uploads the chosen file to `/api/images/upload`
 * (Supabase, folder `categories`) and lifts the resulting public URL via
 * `onChange`, showing a live preview and any upload error.
 */
export function IconUpload({ value, onChange, id, ...aria }: IconUploadProps) {
  const t = useTranslations("dashCategories");
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
      onChange(await imagesApi.upload(file, "categories"));
    } catch (err) {
      // The route's error strings are developer-facing (bad form shape, unknown
      // folder) — log them for debugging, show the localized copy to the admin.
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
          <Image src={value} alt={t("iconPreviewAlt")} width={64} height={64} className="object-contain" />
        ) : (
          <Icon icon={ImagePlus} size="md" className="text-icon-muted" />
        )}
      </Thumbnail>

      <div className="flex flex-col items-start gap-1.5">
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={handleFile}
          {...aria}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? t("uploading") : value ? t("replaceImage") : t("uploadImage")}
        </Button>
        {error ? (
          <FormMessage>{error}</FormMessage>
        ) : (
          <FormMessage tone="hint">{t("uploadHint")}</FormMessage>
        )}
      </div>
    </div>
  );
}

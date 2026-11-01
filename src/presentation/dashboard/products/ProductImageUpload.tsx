"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { DashboardPhotoPreview } from "@/src/presentation/dashboard/DashboardPhotoPreview";
import { FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { imagesApi } from "@/src/presentation/images/image-api";

type ProductImageUploadProps = {
  value?: string;
  onChange: (url: string) => void;
  /** A11y wiring forwarded from the surrounding <Field>. */
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif";

/**
 * Product image picker: uploads the chosen file to `/api/images/upload`
 * (server disk, folder `products`) and lifts the resulting public URL via
 * `onChange`, showing a live preview and any upload error. Mirrors the
 * category `IconUpload`.
 */
export function ProductImageUpload({ value, onChange, id, ...aria }: ProductImageUploadProps) {
  const t = useTranslations("dashProducts");
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
      onChange(await imagesApi.upload(file, "products"));
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
    <div className="flex flex-col items-start gap-3">
      <DashboardPhotoPreview src={value} alt={t("imagePreviewAlt")} emptyLabel={t("noImage")} ratio="photo" />
      <input ref={inputRef} id={id} type="file" accept={ACCEPT} className="sr-only" onChange={handleFile} {...aria} />
      <Button
        type="button"
        variant="secondary"
        size="control-md"
        className="px-3"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? null : <Icon icon={Upload} size="icon-md" className="me-2" />}
        {uploading ? t("uploading") : value ? t("replaceImage") : t("uploadImage")}
      </Button>
      {error ? <FormMessage>{error}</FormMessage> : <p className={FIELD_HINT}>{t("uploadHint")}</p>}
    </div>
  );
}

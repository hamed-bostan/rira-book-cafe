"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import { DashboardPhotoPreview } from "@/src/presentation/dashboard/DashboardPhotoPreview";
import { DANGER_SECONDARY, FIELD_HINT } from "@/src/presentation/dashboard/fieldStyles";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
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
    <div className="flex flex-col gap-3">
      <DashboardPhotoPreview src={value} alt={t("imagePreviewAlt")} emptyLabel={t("noImage")} ratio="video" />
      <input ref={inputRef} id={id} type="file" accept={ACCEPT} className="sr-only" onChange={handleFile} />
      <div className="flex flex-wrap gap-2">
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
        {value ? (
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className={cn("px-3", DANGER_SECONDARY)}
            onClick={() => onChange("")}
          >
            {t("removeImage")}
          </Button>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : <p className={FIELD_HINT}>{t("uploadHint")}</p>}
    </div>
  );
}

"use client";

import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { RECEIPT_IMAGE_FOLDER } from "@/src/lib/imageFolders";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/presentation/design-system/components/Button/Button";
import { FormMessage } from "@/src/presentation/design-system/components/form/FormMessage/FormMessage";
import { Icon } from "@/src/presentation/design-system/components/Icon/Icon";
import { imagesApi } from "@/src/presentation/images/image-api";

import { DANGER_SECONDARY, FIELD_HINT } from "../fieldStyles";

import { ExpenseReceiptPreview } from "./ExpenseReceiptPreview";

type ExpenseReceiptUploadProps = {
  value?: string;
  /** The stored URL, or `""` when the receipt is taken off. */
  onChange: (url: string) => void;
  /** While a file's on its way, so the form around it can wait for it. */
  onUploadingChange?: (uploading: boolean) => void;
  /** Whatever owns the value is saving it. */
  disabled?: boolean;
  id?: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/avif,application/pdf";

/** Photograph or pick a receipt, or a supplier's PDF; it goes to the private receipts folder and reports the stored URL. */
export function ExpenseReceiptUpload({ value, onChange, onUploadingChange, disabled, id }: ExpenseReceiptUploadProps) {
  const t = useTranslations("dashExpenses.receipt");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function setBusy(busy: boolean): void {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be re-selected after an error
    if (!file) return;

    setError(null);
    setBusy(true);
    try {
      onChange(await imagesApi.upload(file, RECEIPT_IMAGE_FOLDER));
    } catch (err) {
      console.error("Receipt upload failed:", err);
      setError(t("uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {value ? <ExpenseReceiptPreview src={value} /> : null}
      <input ref={inputRef} id={id} type="file" accept={ACCEPT} className="sr-only" onChange={handleFile} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="control-md"
          className="px-3"
          loading={uploading}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? null : <Icon icon={Upload} size="icon-md" className="me-2" />}
          {uploading ? t("uploading") : value ? t("replace") : t("upload")}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="secondary"
            size="control-md"
            className={cn("px-3", DANGER_SECONDARY)}
            disabled={disabled || uploading}
            onClick={() => onChange("")}
          >
            {t("remove")}
          </Button>
        ) : null}
      </div>
      {error ? <FormMessage>{error}</FormMessage> : <p className={FIELD_HINT}>{t("hint")}</p>}
    </div>
  );
}

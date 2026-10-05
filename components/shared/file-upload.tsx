"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export type UploadKind = "item-photo" | "lab-attachment" | "po-document";

/**
 * Uploads one file straight to Neon Object Storage via a presigned PUT.
 *
 * The browser PUTs the bytes to the bucket, not to a Next.js route handler: a 10 MB
 * purchase-order PDF would otherwise pass through the function and run into the
 * server-action body limit. Two steps, and both can fail independently —
 * 1. POST /api/uploads/presign with the declared type and size (the server
 *    re-checks both, so this is a UX affordance, not the enforcement point).
 * 2. PUT the file to the returned URL.
 *
 * `onUploaded` then receives the object key. Nothing is persisted until the caller
 * saves it on its own record, so an abandoned upload leaves an orphaned object and
 * never a row pointing at nothing.
 */
export async function uploadFile(
  kind: UploadKind,
  file: File,
): Promise<{ key: string }> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, filename: file.name, contentType: file.type, size: file.size }),
  });
  const presignBody = await presign.json().catch(() => ({}));
  if (!presign.ok) throw new Error(presignBody.error ?? "Could not prepare the upload");

  const put = await fetch(presignBody.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("The file could not be uploaded");

  return { key: presignBody.key as string };
}

export function FileUpload({
  kind,
  /** Existing object key, rendered as the current attachment. */
  value,
  onUploaded,
  onCleared,
  label,
  accept,
  hint,
  className,
}: {
  kind: UploadKind;
  value?: string | null;
  onUploaded: (key: string) => void;
  onCleared?: () => void;
  label?: string;
  accept?: string;
  hint?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const { key } = await uploadFile(kind, file);
      onUploaded(key);
      toast.success(t.common.uploadComplete);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.common.uploadFailed);
    } finally {
      setBusy(false);
      // Reset so re-picking the same file still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      {label && <p className="mb-1.5 text-sm font-medium">{label}</p>}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(event) => handleFile(event.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          {/* Storage keys are opaque; the last segment is the only human-meaningful part. */}
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{value.split("/").pop()}</span>
          <a
            href={`/api/uploads?key=${encodeURIComponent(value)}`}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
          >
            {t.common.view}
          </a>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onCleared} aria-label={t.common.removeAttachment}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? t.common.uploading : t.common.upload}
        </Button>
      )}

      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Read-only badge for a row that already has a document attached. */
export function AttachmentLink({ objectKey, label }: { objectKey: string; label?: string }) {
  const { t } = useI18n();
  return (
    <a
      href={`/api/uploads?key=${encodeURIComponent(objectKey)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
    >
      <Paperclip className="h-3 w-3" />
      {label ?? t.common.attachment}
    </a>
  );
}
"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function filenameFromDisposition(header: string | null) {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Prints the page to PDF through the browser's own pipeline, which is the only
 * way to keep Arabic letter shaping and RTL table layout intact.
 *
 * With a `sectionId` only that single report card survives; everything else
 * carrying `data-print-section` / `data-print-role` is flagged so the print
 * stylesheet can drop it. Flags are always cleared afterwards so the on-screen
 * view is untouched.
 */
function printReport(sectionId: string | null, documentTitle: string) {
  const excluded: HTMLElement[] = [];

  if (sectionId !== null) {
    document
      .querySelectorAll<HTMLElement>("[data-print-section], [data-print-role]")
      .forEach((node) => {
        if (node.dataset.printSection === sectionId) return;
        excluded.push(node);
        node.dataset.printExclude = "true";
      });
  }

  const titleNode = document.querySelector<HTMLElement>("[data-print-section-title]");
  if (titleNode) titleNode.textContent = documentTitle;

  const previousTitle = document.title;
  document.title = documentTitle;

  const restore = () => {
    excluded.forEach((node) => delete node.dataset.printExclude);
    document.title = previousTitle;
  };

  window.addEventListener("afterprint", restore, { once: true });
  // Some engines never fire afterprint, so clean up regardless.
  window.setTimeout(restore, 2000);
  window.print();
  window.setTimeout(restore, 300);
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function ReportExportButtons({ disabled = false }: { disabled?: boolean }) {
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const exportUrl = useMemo(() => {
    const query = searchParams.toString();
    return `/api/reports/export${query ? `?${query}` : ""}`;
  }, [searchParams]);

  const downloadExcel = useCallback(async (url: string, fallbackName: string, loadingMessage: string) => {
    setExporting(true);
    const toastId = toast.loading(loadingMessage);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "تعذّر إنشاء ملف Excel");
      }
      saveBlob(
        await response.blob(),
        filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName,
      );
      toast.success("تم تصدير التقرير إلى Excel", { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تصدير التقرير إلى Excel", { id: toastId });
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Button
        onClick={() => downloadExcel(exportUrl, "IMS-Reports.xlsx", "جارٍ تجهيز ملف Excel…")}
        disabled={disabled || exporting}
        size="sm"
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        تصدير Excel
      </Button>
      <Button
        onClick={() => printReport(null, `IMS - تقرير شامل - ${todayStamp()}`)}
        disabled={disabled}
        variant="outline"
        size="sm"
      >
        <FileText className="h-4 w-4" />
        تصدير PDF
      </Button>
    </div>
  );
}

/** Per-report export pair rendered inside a single report card header. */
export function ReportSectionExportButtons({
  sectionId,
  sectionTitle,
  rowCount,
}: {
  sectionId: string;
  sectionTitle: string;
  rowCount: number;
}) {
  const searchParams = useSearchParams();
  const [exporting, setExporting] = useState(false);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", sectionId);
    return `/api/reports/export?${params.toString()}`;
  }, [searchParams, sectionId]);

  const downloadExcel = useCallback(
    async (url: string, fallbackName: string, loadingMessage: string) => {
      setExporting(true);
      const toastId = toast.loading(loadingMessage);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? "تعذّر إنشاء ملف Excel");
        }
        saveBlob(
          await response.blob(),
          filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName,
        );
        toast.success("تم تصدير هذا التقرير إلى Excel", { id: toastId });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "تعذّر تصدير هذا التقرير إلى Excel",
          { id: toastId },
        );
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  const disabled = rowCount === 0;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 print:hidden">
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 px-2 text-xs"
        disabled={disabled || exporting}
        title="تصدير هذا التقرير فقط إلى Excel"
        onClick={() => downloadExcel(exportUrl, `${sectionId}.xlsx`, `جارٍ تجهيز «${sectionTitle}»…`)}
      >
        {exporting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-3.5 w-3.5" />
        )}
        Excel
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 gap-1.5 px-2 text-xs"
        disabled={disabled}
        title="طباعة هذا التقرير فقط أو حفظه كـ PDF"
        onClick={() => printReport(sectionId, `IMS - ${sectionTitle}`)}
      >
        <FileText className="h-3.5 w-3.5" />
        PDF
      </Button>
    </div>
  );
}
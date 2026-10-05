import { NextRequest, NextResponse } from "next/server";
import { handleApiError, requireModuleAccess } from "@/lib/api-helpers";
import { DateRangeParams, resolveDateRange } from "@/lib/date-range";
import { getEarliestRecordDate } from "@/lib/dashboard-metrics";
import { getReportSuite } from "@/lib/report-data";
import { UnknownReportSectionError, XLSX_MIME, buildReportWorkbook } from "@/lib/report-workbook";
import { getMessages, LOCALE_COOKIE, resolveLocale } from "@/lib/i18n-messages";

// exceljs is a Node-only dependency.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readParams(searchParams: URLSearchParams): DateRangeParams {
  return {
    preset: searchParams.get("preset") ?? undefined,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    fromTime: searchParams.get("fromTime"),
    toTime: searchParams.get("toTime"),
  };
}

function asciiFileName(...parts: string[]) {
  const value = parts
    .join("-")
    .normalize("NFKD")
    // Header values must be ByteString, so the plain filename stays ASCII and
    // the Arabic title only travels through the RFC 5987 `filename*` form.
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "report";
}

/** ASCII-safe base plus an RFC 5987 encoded Arabic label so both clients resolve it. */
function contentDisposition(base: string, label: string) {
  return `attachment; filename="${base}"; filename*=UTF-8''${encodeURIComponent(label)}`;
}

export async function GET(req: NextRequest) {
  const { error } = await requireModuleAccess("reports");
  if (error) return error;

  try {
    const searchParams = req.nextUrl.searchParams;
    const sectionId = searchParams.get("section")?.trim() || undefined;

    const earliest = await getEarliestRecordDate();
    const range = resolveDateRange(readParams(searchParams), earliest);
const t = getMessages(resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value));
    const suite = await getReportSuite(range, t);
    const workbook = await buildReportWorkbook(suite, { sectionId, t });

    const stamp = suite.generatedAt.toISOString().slice(0, 10);
    const section = sectionId ? suite.sections.find((entry) => entry.id === sectionId) : undefined;

    const base = section
      ? `IMS-${asciiFileName("report", section.id)}-${stamp}.xlsx`
      : `IMS-Reports-${stamp}.xlsx`;
    const label = section
      ? `${suite.title} - ${section.title} - ${suite.rangeLabel}.xlsx`
      : `${suite.title} - ${suite.rangeLabel}.xlsx`;

    return new Response(workbook, {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": contentDisposition(base, label),
        "Content-Length": String(workbook.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof UnknownReportSectionError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return handleApiError(err);
  }
}
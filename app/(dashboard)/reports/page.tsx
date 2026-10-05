import { Suspense } from "react";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { ReportExportButtons } from "@/components/shared/report-export-buttons";
import { ReportMetricsStrip, ReportSectionCard } from "@/components/shared/report-view";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { Badge } from "@/components/ui/badge";
import { DateRangeParams, resolveDateRange } from "@/lib/date-range";
import { getEarliestRecordDate } from "@/lib/dashboard-metrics";
import { getReportSuite } from "@/lib/report-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const param = (key: string): string | undefined => {
    const value = rawParams[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const params: DateRangeParams = {
    preset: param("preset"),
    from: param("from"),
    to: param("to"),
    fromTime: param("fromTime"),
    toTime: param("toTime"),
  };

  const earliest = await getEarliestRecordDate();
  const range = resolveDateRange(params, earliest);
  const suite = await getReportSuite(range);

  const printedAt = formatDateTime(suite.generatedAt);
  const isEmpty = suite.sections.every((section) => section.rows.length === 0);

  return (
    <div className="space-y-6 print:pb-10">
      <OfflineBanner />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">التقارير</h1>
          <p className="text-sm text-muted-foreground">
            تقارير تفصيلية قابلة للتصدير إلى Excel و PDF عن الفترة{" "}
            <span className="tabular-nums">{suite.rangeLabel}</span>
          </p>
        </div>
        <Suspense fallback={null}>
          <ReportExportButtons disabled={isEmpty} />
        </Suspense>
      </div>

      {/* Print-only identity block: the client swaps its title when a single
          report is printed, and it repeats on every PDF page as a footer. */}
      <div className="hidden print:block">
        <h1 data-print-section-title className="text-lg font-semibold">
          {suite.title}
        </h1>
        <p className="text-[10pt] text-muted-foreground">
          الفترة: <span className="tabular-nums">{suite.rangeLabel}</span> · تاريخ الاستخراج:{" "}
          <span className="tabular-nums">{printedAt}</span> · العملة: {suite.currency}
        </p>
      </div>

      {/* Repeats on every PDF page because print layouts treat it as fixed. */}
      <div className="hidden print:block print:fixed print:bottom-0 print:left-0 print:right-0 print:border-t print:pb-1 print:pt-1 print:text-[8pt] print:text-muted-foreground">
        IMS Manufacturing · {suite.title} · <span className="tabular-nums">{suite.rangeLabel}</span>
      </div>

      <DateRangeFilter fallbackFrom={earliest?.toISOString()} />

      <div
        data-print-role="meta"
        className="flex flex-wrap items-center gap-1.5 print:hidden"
      >
        <Badge variant="outline">
          {suite.sections.length} تقرير · <span className="tabular-nums">{printedAt}</span>
        </Badge>
        <Badge variant="outline">العملة: {suite.currency}</Badge>
      </div>

      <section className="space-y-3">
        <div data-print-role="summary-heading" className="print:hidden">
          <h2 className="text-base font-semibold tracking-tight">المؤشرات الملخصة</h2>
          <p className="text-xs text-muted-foreground">
            الأرقام الأساسية للفترة المختارة مقارنة بالفترة السابقة لها
          </p>
        </div>
        <ReportMetricsStrip metrics={suite.metrics} />
      </section>

      {suite.sections.map((section) => (
        <ReportSectionCard key={section.id} section={section} />
      ))}
    </div>
  );
}
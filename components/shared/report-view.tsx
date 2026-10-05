"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, type KpiIcon } from "@/components/shared/kpi-card";
import { ReportSectionExportButtons } from "@/components/shared/report-export-buttons";
import { formatDelta, formatNumber } from "@/lib/utils";
import { formatReportCell, type ReportMetric, type ReportSection } from "@/lib/report-data";
import { useI18n } from "@/lib/i18n";

const METRIC_ICONS: Record<string, KpiIcon> = {
  revenue: "wallet",
  cogs: "receipt",
  grossProfit: "trendingUp",
  purchases: "truck",
  netCashFlow: "coins",
  inventoryValue: "boxes",
  lowStock: "alertTriangle",
  productionQty: "factory",
  labPassRate: "lab",
  avgOrderValue: "shoppingCart",
};

const INVERSE_METRICS = new Set(["cogs", "purchases"]);

function alignmentFor(kind: ReportSection["columns"][number]["kind"]) {
  if (kind === "date") return "text-center";
  if (kind === "integer" || kind === "decimal" || kind === "money" || kind === "percent") {
    return "text-right tabular-nums font-medium";
  }
  return "text-right";
}

export function ReportMetricsStrip({ metrics }: { metrics: ReportMetric[] }) {
  return (
    <div
      data-print-role="summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4"
    >
      {metrics.map((metric) => (
        <KpiCard
          key={metric.id}
          label={metric.label}
          value={formatReportCell(metric.value, metric.kind)}
          icon={METRIC_ICONS[metric.id] ?? "wallet"}
          deltaPct={metric.deltaPct}
          tone={INVERSE_METRICS.has(metric.id) ? "inverse" : "default"}
          footer={metric.hint}
        />
      ))}
    </div>
  );
}

export function ReportSectionCard({ section }: { section: ReportSection }) {
  const { t, locale } = useI18n();
  return (
    <Card data-print-section={section.id} className="print:break-inside-avoid print:shadow-none">
      <CardHeader className="print:pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="tabular-nums">
              {formatNumber(section.rows.length, 0, locale === "ar" ? "ar-EG" : "en-US")} {t.reports.recordsUnit}
            </Badge>
            <ReportSectionExportButtons
              sectionId={section.id}
              sectionTitle={section.title}
              rowCount={section.rows.length}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {section.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t.reports.emptyRange}
          </p>
        ) : (
          <div data-print-table className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {section.columns.map((column) => (
                    <TableHead key={column.key} className={alignmentFor(column.kind)}>
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.rows.map((row, rowIndex) => (
                  <TableRow
                    key={`${section.id}-${rowIndex}`}
                    className="print:bg-white print:even:bg-slate-100"
                  >
                    {section.columns.map((column) => (
                      <TableCell key={column.key} className={alignmentFor(column.kind)}>
                        {formatReportCell(row[column.key] ?? null, column.kind)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportDeltaNote({ label, value }: { label: string; value: number | null }) {
  const { t } = useI18n();
  const delta = formatDelta(value);
  return (
    <span className="text-xs text-muted-foreground">
      {label}: {delta ?? t.kpi.noPrevious}
    </span>
  );
}
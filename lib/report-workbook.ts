import ExcelJS from "exceljs";
import { formatDateTime } from "@/lib/utils";
import type { ReportCell, ReportColumnKind, ReportSuite } from "@/lib/report-data";
import type { Messages } from "@/lib/i18n-messages";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Raised when `?section=` names a report the suite does not contain. */
export class UnknownReportSectionError extends Error {
  constructor(sectionId: string) {
    super(`Unknown report section "${sectionId}"`);
    this.name = "UnknownReportSectionError";
  }
}

const BRAND = "FF1E3A8A";
const BRAND_SOFT = "FFE8EEFB";
const TOTAL_FILL = "FFF1F5F9";

const NUMBER_FORMATS: Record<ReportColumnKind, string> = {
  text: "@",
  integer: "#,##0",
  decimal: "#,##0.00",
  money: "#,##0.00",
  percent: '0.0"%"',
  date: "yyyy-mm-dd",
};

const COLUMN_WIDTH: Record<ReportColumnKind, number> = {
  text: 24,
  integer: 16,
  decimal: 14,
  money: 18,
  percent: 14,
  date: 14,
};

const RIGHT_ALIGN: Record<ReportColumnKind, ExcelJS.Alignment["horizontal"]> = {
  integer: "right",
  decimal: "right",
  money: "right",
  percent: "right",
  date: "center",
  text: "right",
};

/** 1 -> "A", 27 -> "AA". Needed because SUBTOTAL formulas must use A1 notation. */
function columnLetter(index: number) {
  let value = index;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

/** Excel rejects these characters in sheet names and caps them at 31 characters. */
function safeSheetName(title: string, taken: Set<string>, fallback: string) {
  const base = title.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || fallback;
  let name = base;
  let suffix = 2;
  while (taken.has(name)) {
    const marker = ` ${suffix++}`;
    name = `${base.slice(0, 31 - marker.length)}${marker}`;
  }
  taken.add(name);
  return name;
}

function cellValue(value: ReportCell, kind: ReportColumnKind): ExcelJS.CellValue {
  if (value === null || value === undefined) return null;
  switch (kind) {
    case "date": {
      if (value instanceof Date) return value;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed;
    }
    case "integer":
    case "decimal":
    case "money":
    case "percent": {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    default:
      return value instanceof Date ? formatDateTime(value) : String(value);
  }
}

function configureColumns(sheet: ExcelJS.Worksheet, section: ReportSuite["sections"][number]) {
  section.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = Math.max(COLUMN_WIDTH[column.kind], Math.min(34, column.label.length + 4));
  });
}

function configurePageSetup(sheet: ExcelJS.Worksheet, t: Messages) {
  sheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  sheet.headerFooter = {
    oddFooter: `&L&8IMS — ${t.reports.title}&R&8${t.reports.excel.pageOf.replace("{page}", "&P").replace("{pageCount}", "&N")}`,
  };
}

/** Metadata + headline KPIs. Only added to full-suite exports, not single reports. */
function addCoverSheet(workbook: ExcelJS.Workbook, suite: ReportSuite, t: Messages) {
  const cover = workbook.addWorksheet(t.reports.excel.coverSheet, {
    pageSetup: { orientation: "portrait", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  configurePageSetup(cover, t);

  cover.mergeCells("A1:C1");
  cover.getCell("A1").value = suite.title;
  cover.getCell("A1").font = { bold: true, size: 16, color: { argb: BRAND } };
  cover.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  cover.getRow(1).height = 26;

  const meta: Array<[string, string]> = [
    [t.reports.excel.metaPeriod, suite.rangeLabel],
    [t.reports.excel.metaGeneratedAt, formatDateTime(suite.generatedAt)],
    [t.reports.excel.metaCurrency, suite.currency],
    [t.reports.excel.metaSectionCount, String(suite.sections.length)],
  ];
  meta.forEach(([key, value], index) => {
    const row = cover.getRow(index + 2);
    row.getCell(1).value = key;
    row.getCell(1).font = { bold: true, color: { argb: BRAND } };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { horizontal: "right" };
  });

  const headerOffset = meta.length + 3;
  const headerRow = cover.getRow(headerOffset);
  [t.reports.excel.metricColumn, t.reports.excel.valueColumn, t.reports.excel.deltaColumn].forEach((text, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = text;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  suite.metrics.forEach((metric, index) => {
    const row = cover.getRow(headerOffset + 1 + index);
    row.getCell(1).value = metric.label;
    if (metric.hint) row.getCell(1).note = metric.hint;
    const valueCell = row.getCell(2);
    valueCell.value = metric.value;
    valueCell.numFmt = NUMBER_FORMATS[metric.kind];
    valueCell.alignment = { horizontal: "right" };
    row.getCell(3).value =
      metric.deltaPct === null ? "—" : `${metric.deltaPct > 0 ? "+" : ""}${metric.deltaPct.toFixed(1)}%`;
    row.getCell(3).alignment = { horizontal: "center" };
    if (index % 2 === 1) {
      [1, 2, 3].forEach((column) => {
        row.getCell(column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
      });
    }
  });

  cover.getColumn(1).width = 34;
  cover.getColumn(2).width = 22;
  cover.getColumn(3).width = 26;
  cover.views = [{ rightToLeft: true, state: "frozen", ySplit: headerOffset, showGridLines: false }];
}

export async function buildReportWorkbook(
  suite: ReportSuite,
  options: { sectionId?: string; t: Messages },
): Promise<Uint8Array> {
  const { t } = options;
  const sections = options.sectionId
    ? suite.sections.filter((section) => section.id === options.sectionId)
    : suite.sections;

  if (options.sectionId && sections.length === 0) {
    throw new UnknownReportSectionError(options.sectionId);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "IMS Manufacturing";
  workbook.created = suite.generatedAt;

  const taken = new Set<string>();
  if (!options.sectionId) addCoverSheet(workbook, suite, t);

  for (const section of sections) {
    const sheet = workbook.addWorksheet(safeSheetName(section.title, taken, t.reports.excel.sheetFallback));
    configurePageSetup(sheet, t);
    const lastColumn = section.columns.length;

    sheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = section.title;
    titleCell.font = { bold: true, size: 13, color: { argb: BRAND } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
    titleCell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    sheet.getRow(1).height = 22;

    sheet.mergeCells(2, 1, 2, lastColumn);
    const descriptionCell = sheet.getCell(2, 1);
    descriptionCell.value = `${section.description} — ${suite.rangeLabel}`;
    descriptionCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
    descriptionCell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
    sheet.getRow(2).height = 18;

    const headerIndex = 4;
    const headerRow = sheet.getRow(headerIndex);
    section.columns.forEach((column, index) => {
      const cell = headerRow.getCell(index + 1);
      cell.value = column.label;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    headerRow.height = 24;

    section.rows.forEach((record, rowIndex) => {
      const row = sheet.getRow(headerIndex + 1 + rowIndex);
      section.columns.forEach((column, columnIndex) => {
        const cell = row.getCell(columnIndex + 1);
        cell.value = cellValue(record[column.key] ?? null, column.kind);
        cell.numFmt = NUMBER_FORMATS[column.kind];
        cell.alignment = { horizontal: RIGHT_ALIGN[column.kind], vertical: "middle" };
        if (rowIndex % 2 === 1) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
        }
      });
    });

    const lastDataRow = headerIndex + section.rows.length;
    sheet.autoFilter = {
      from: { row: headerIndex, column: 1 },
      to: { row: Math.max(lastDataRow, headerIndex), column: lastColumn },
    };
    sheet.views = [
      { rightToLeft: true, state: "frozen", ySplit: headerIndex, xSplit: 0, showGridLines: false },
    ];

    // Totals row: only additive columns, so it never mixes incompatible units.
    const additive = section.columns.filter(
      (column) => column.kind === "integer" || column.kind === "money" || column.kind === "decimal",
    );
    if (additive.length > 0 && section.rows.length > 0) {
      const totalsRow = sheet.getRow(lastDataRow + 1);
      totalsRow.getCell(1).value = t.common.total;
      section.columns.forEach((column, columnIndex) => {
        const cell = totalsRow.getCell(columnIndex + 1);
        cell.font = { bold: true, color: { argb: BRAND } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_SOFT } };
        cell.border = { top: { style: "double", color: { argb: BRAND } } };
        cell.alignment = { horizontal: "right", vertical: "middle" };
        if (column.kind === "integer" || column.kind === "money" || column.kind === "decimal") {
          const letter = columnLetter(columnIndex + 1);
          cell.value = { formula: `SUBTOTAL(109,${letter}${headerIndex + 1}:${letter}${lastDataRow})` };
          cell.numFmt = NUMBER_FORMATS[column.kind];
        }
      });
    }

    configureColumns(sheet, section);
    sheet.getColumn(1).alignment = { horizontal: "right" };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
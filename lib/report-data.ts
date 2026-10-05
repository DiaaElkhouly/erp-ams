import { db } from "@/lib/db";
import { buildWindow } from "@/lib/dashboard-metrics";
import {
  DateRange, bucketKey, bucketLabel, createEmptyBuckets, eachBucket,
  formatRangeLabel, previousPeriod,
} from "@/lib/date-range";
import { DEFAULT_CURRENCY, formatDate, formatMoney, formatNumber, formatPercent, percentChange } from "@/lib/utils";
import type { Messages } from "@/lib/i18n-messages";

/**
 * A report suite is a renderer-agnostic description of every report on the page:
 * the React page and the Excel exporter both walk the same structure, so the two
 * can never drift apart.
 */
export type ReportColumnKind = "text" | "integer" | "decimal" | "money" | "percent" | "date";

export type ReportColumn = {
  key: string;
  label: string;
  kind: ReportColumnKind;
};

export type ReportCell = string | number | Date | null;

export type ReportRow = Record<string, ReportCell>;

export type ReportSection = {
  id: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: ReportRow[];
};

export type ReportMetric = {
  id: string;
  label: string;
  value: number;
  kind: Exclude<ReportColumnKind, "text" | "date">;
  /** Signed change against the previous, equally long window. */
  deltaPct: number | null;
  hint?: string;
};

export type ReportSuite = {
  title: string;
  rangeLabel: string;
  from: Date;
  to: Date;
  generatedAt: Date;
  currency: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
};

/**
 * Status and enum labels come from the catalog so a suite is written once in the
 * user's language instead of baking Arabic into the query layer.
 */
function enumLabels(t: Messages) {
  return {
    itemType: t.itemType as Record<string, string>,
    sales: { DRAFT: t.status.DRAFT, CONFIRMED: t.status.CONFIRMED, FULFILLED: t.status.FULFILLED, CANCELLED: t.status.CANCELLED } as Record<string, string>,
    purchase: { DRAFT: t.status.DRAFT, ORDERED: t.status.ORDERED, RECEIVED: t.status.RECEIVED, CANCELLED: t.status.CANCELLED } as Record<string, string>,
    workOrder: {
      PLANNED: t.status.PLANNED, RELEASED: t.status.RELEASED, IN_PROGRESS: t.status.IN_PROGRESS,
      COMPLETED: t.status.COMPLETED, CANCELLED: t.status.CANCELLED,
    } as Record<string, string>,
    lab: t.labStatus as Record<string, string>,
    labCategory: t.reports.labCategory as Record<string, string>,
    granularity: t.reports.granularity as Record<string, string>,
  };
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const round2 = (value: number) => Math.round(value * 100) / 100;
const safePct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function formatReportCell(value: ReportCell, kind: ReportColumnKind): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (kind) {
    case "money":
      return formatMoney(Number(value), DEFAULT_CURRENCY);
    case "percent":
      return formatPercent(Number(value));
    case "integer":
      return formatNumber(Number(value), 0);
    case "decimal":
      return formatNumber(Number(value), 2);
    case "date":
      return value instanceof Date ? formatDate(value) : String(value);
    default:
      return String(value);
  }
}

function label(key: string, text: string, kind: ReportColumnKind = "text"): ReportColumn {
  return { key, label: text, kind };
}

function stockStatusLabel(onHand: number, reorderPoint: number, t: Messages) {
  if (onHand === 0) return t.reports.levels.outOfStock;
  if (reorderPoint > 0 && onHand <= reorderPoint / 2) return t.reports.levels.critical;
  return t.reports.levels.low;
}

export async function getReportSuite(range: DateRange, t: Messages): Promise<ReportSuite> {
  const prev = previousPeriod(range);
  const labels = enumLabels(t);

  const [
    current,
    previous,
    items,
    warehouses,
    allSalesOrders,
    allPurchaseOrders,
    workOrders,
    completedProduction,
    labTests,
  ] = await Promise.all([
    buildWindow(range),
    buildWindow({ ...prev, days: range.days, granularity: range.granularity }),
    db.item.findMany({
      where: { isActive: true },
      orderBy: { sku: "asc" },
      select: {
        sku: true,
        name: true,
        type: true,
        unit: true,
        costPrice: true,
        salePrice: true,
        reorderPoint: true,
        reorderQty: true,
        stockLevels: { select: { quantity: true, warehouseId: true } },
      },
    }),
    db.warehouse.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, location: true },
    }),
    db.salesOrder.findMany({
      where: { orderDate: { gte: range.from, lte: range.to } },
      orderBy: { orderDate: "asc" },
      select: {
        orderNumber: true,
        status: true,
        orderDate: true,
        customer: { select: { name: true } },
        lines: { select: { quantity: true, unitPrice: true } },
      },
    }),
    db.purchaseOrder.findMany({
      where: { orderDate: { gte: range.from, lte: range.to } },
      orderBy: { orderDate: "asc" },
      select: {
        orderNumber: true,
        status: true,
        orderDate: true,
        supplier: { select: { name: true } },
        lines: { select: { quantity: true, unitCost: true } },
      },
    }),
    db.workOrder.findMany({
      where: {
        OR: [
          { startDate: { gte: range.from, lte: range.to } },
          { dueDate: { gte: range.from, lte: range.to } },
          { completedAt: { gte: range.from, lte: range.to } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        orderNumber: true,
        quantity: true,
        status: true,
        startDate: true,
        dueDate: true,
        completedAt: true,
        item: { select: { sku: true, name: true } },
        warehouse: { select: { code: true, name: true } },
      },
    }),
    db.workOrder.findMany({
      where: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } },
      select: { quantity: true, completedAt: true },
    }),
    db.labTestRecord.findMany({
      where: { testedAt: { gte: range.from, lte: range.to } },
      orderBy: { testedAt: "desc" },
      select: {
        testedAt: true,
        category: true,
        material: true,
        testName: true,
        result: true,
        unit: true,
        standard: true,
        minValue: true,
        maxValue: true,
        status: true,
      },
    }),
  ]);

  const window = current.metrics;
  const prevWindow = previous.metrics;

  // --- inventory -----------------------------------------------------------
  const inventoryRows = items.map((item) => {
    const onHand = sum(item.stockLevels.map((level) => level.quantity));
    const cost = Number(item.costPrice);
    const salePrice = round2(Number(item.salePrice));
    return {
      sku: item.sku,
      name: item.name,
      type: item.type,
      unit: item.unit,
      cost,
      onHand,
      // Raw materials and consumables carry no selling price; report a gap
      // instead of a misleading zero.
      salePrice: salePrice > 0 ? salePrice : null,
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      value: round2(onHand * cost),
      retailValue: salePrice > 0 ? round2(onHand * salePrice) : null,
    };
  });

  const inventoryValue = round2(sum(inventoryRows.map((row) => row.value)));
  const lowStockRows = inventoryRows
    .filter((row) => row.onHand <= row.reorderPoint)
    .map((row) => ({ ...row, shortage: Math.max(0, row.reorderPoint - row.onHand) }))
    .sort((a, b) => a.onHand - b.onHand || a.sku.localeCompare(b.sku));

  const warehouseRows = warehouses
    .map((warehouse) => {
      let qty = 0;
      let skus = 0;
      let value = 0;
      for (const item of items) {
        const level = item.stockLevels.find((entry) => entry.warehouseId === warehouse.id);
        if (!level || level.quantity <= 0) continue;
        qty += level.quantity;
        skus += 1;
        value += level.quantity * Number(item.costPrice);
      }
      return { ...warehouse, skus, qty, value: round2(value) };
    })
    .sort((a, b) => b.value - a.value);

  // --- sales / purchase orders (all statuses, for status + detail tables) ---
  const salesStatusMap = new Map<string, { count: number; value: number }>();
  const salesDetail = allSalesOrders.map((order) => {
    const value = round2(sum(order.lines.map((line) => line.quantity * Number(line.unitPrice))));
    const qty = sum(order.lines.map((line) => line.quantity));
    const entry = salesStatusMap.get(order.status) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += value;
    salesStatusMap.set(order.status, entry);
    return {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      party: order.customer.name,
      status: order.status,
      lines: order.lines.length,
      qty,
      value,
    };
  });

  const purchaseStatusMap = new Map<string, { count: number; value: number }>();
  const purchaseDetail = allPurchaseOrders.map((order) => {
    const value = round2(sum(order.lines.map((line) => line.quantity * Number(line.unitCost))));
    const qty = sum(order.lines.map((line) => line.quantity));
    const entry = purchaseStatusMap.get(order.status) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += value;
    purchaseStatusMap.set(order.status, entry);
    return {
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      party: order.supplier.name,
      status: order.status,
      lines: order.lines.length,
      qty,
      value,
    };
  });

  const statusSection = (
    id: string,
    title: string,
    description: string,
    labels: Record<string, string>,
    map: Map<string, { count: number; value: number }>,
  ): ReportSection => {
    const total = round2(sum([...map.values()].map((entry) => entry.value)));
    return {
      id,
      title,
      description,
      columns: [
        label("status", t.reports.columns.status),
        label("count", t.reports.columns.orderCount, "integer"),
        label("value", t.reports.columns.value, "money"),
        label("share", t.common.share, "percent"),
      ],
      rows: [...map.entries()]
        .map(([status, entry]) => ({
          status: labels[status] ?? status,
          count: entry.count,
          value: round2(entry.value),
          share: round2(safePct(entry.value, total)),
        }))
        .sort((a, b) => b.value - a.value),
    };
  };

  // --- production / sales trend per bucket ---------------------------------
  const buckets = createEmptyBuckets(range);
  for (const order of current.sales) {
    const bucket = buckets[bucketKey(order.orderDate, range.granularity)];
    if (!bucket) continue;
    bucket.salesOrders += 1;
    for (const line of order.lines) {
      bucket.revenue += line.quantity * line.unitPrice;
      bucket.cogs += line.quantity * line.costPrice;
      bucket.unitsSold += line.quantity;
    }
  }
  for (const order of current.purchases) {
    const bucket = buckets[bucketKey(order.orderDate, range.granularity)];
    if (!bucket) continue;
    bucket.purchaseOrders += 1;
    for (const line of order.lines) bucket.purchases += line.quantity * line.unitCost;
  }
  for (const order of completedProduction) {
    if (!order.completedAt) continue;
    const bucket = buckets[bucketKey(order.completedAt, range.granularity)];
    if (bucket) bucket.productionQty += order.quantity;
  }
  for (const record of labTests) {
    const bucket = buckets[bucketKey(record.testedAt, range.granularity)];
    if (!bucket) continue;
    bucket.labTotal += 1;
    if (record.status === "PASS") bucket.labPassed += 1;
  }

  const trendRows = eachBucket(range.from, range.to, range.granularity).map((date) => {
    const bucket = buckets[bucketKey(date, range.granularity)] ?? null;
    const revenue = round2(bucket?.revenue ?? 0);
    const cogs = round2(bucket?.cogs ?? 0);
    const purchases = round2(bucket?.purchases ?? 0);
    return {
      period: bucketLabel(date, range.granularity, { week: t.weekPrefix }),
      salesOrders: bucket?.salesOrders ?? 0,
      unitsSold: bucket?.unitsSold ?? 0,
      revenue,
      cogs,
      profit: round2(revenue - cogs),
      marginPct: round2(safePct(revenue - cogs, revenue)),
      purchases,
      netCashFlow: round2(revenue - purchases),
      productionQty: bucket?.productionQty ?? 0,
      labPassed: bucket?.labPassed ?? 0,
      labTotal: bucket?.labTotal ?? 0,
    };
  });

  // --- lab quality ---------------------------------------------------------
  const labCategoryMap = new Map<string, { total: number; pass: number; review: number; fail: number }>();
  for (const record of labTests) {
    const entry = labCategoryMap.get(record.category) ?? { total: 0, pass: 0, review: 0, fail: 0 };
    entry.total += 1;
    if (record.status === "PASS") entry.pass += 1;
    else if (record.status === "REVIEW") entry.review += 1;
    else entry.fail += 1;
    labCategoryMap.set(record.category, entry);
  }

  // --- summary metrics -----------------------------------------------------
  const metrics: ReportMetric[] = [
    { id: "revenue", label: t.dashboard.revenue, value: window.revenue, kind: "money", deltaPct: percentChange(window.revenue, prevWindow.revenue), hint: t.reports.metricHints.salesOrders(String(window.salesOrderCount)) },
    { id: "cogs", label: t.dashboard.cogs, value: window.cogs, kind: "money", deltaPct: percentChange(window.cogs, prevWindow.cogs), hint: t.reports.metricHints.unitsSold(String(window.unitsSold)) },
    { id: "grossProfit", label: t.dashboard.grossProfit, value: window.grossProfit, kind: "money", deltaPct: percentChange(window.grossProfit, prevWindow.grossProfit), hint: t.reports.metricHints.ofRevenue(formatPercent(window.grossMarginPct)) },
    { id: "purchases", label: t.dashboard.purchasesValue, value: window.purchases, kind: "money", deltaPct: percentChange(window.purchases, prevWindow.purchases), hint: t.reports.metricHints.purchaseOrders(String(window.purchaseOrderCount)) },
    { id: "netCashFlow", label: t.dashboard.netCashFlow, value: window.netCashFlow, kind: "money", deltaPct: percentChange(window.netCashFlow, prevWindow.netCashFlow), hint: t.reports.metricHints.collected(formatPercent(window.cashConversionPct)) },
    { id: "inventoryValue", label: t.dashboard.inventoryValue, value: inventoryValue, kind: "money", deltaPct: null, hint: t.reports.metricHints.itemCount(String(inventoryRows.length)) },
    { id: "lowStock", label: t.dashboard.lowStockItems, value: lowStockRows.length, kind: "integer", deltaPct: null, hint: t.reports.metricHints.needsRestock },
    { id: "productionQty", label: t.dashboard.producedQty, value: window.productionQty, kind: "integer", deltaPct: percentChange(window.productionQty, prevWindow.productionQty), hint: t.reports.metricHints.completedWorkOrders(String(window.completedWorkOrders)) },
    { id: "labPassRate", label: t.dashboard.labPassRate, value: window.labPassRatePct, kind: "percent", deltaPct: percentChange(window.labPassRatePct, prevWindow.labPassRatePct), hint: t.reports.metricHints.testsOf(String(window.labPassed), String(window.labTotal)) },
    { id: "avgOrderValue", label: t.reports.reorder.avgOrderValue, value: window.avgOrderValue, kind: "money", deltaPct: percentChange(window.avgOrderValue, prevWindow.avgOrderValue), hint: t.reports.metricHints.distinctCustomers(String(window.distinctCustomers)) },
  ];

  const sections: ReportSection[] = [
    {
      id: "inventory-valuation",
      title: t.reports.valuation.title,
      description: `${t.reports.valuation.atCost}, ${t.reports.valuation.atSale} (${formatRangeLabel(range)})`,
      columns: [
        label("sku", t.reports.columns.sku),
        label("name", t.reports.columns.itemName),
        label("type", t.reports.columns.itemType),
        label("unit", t.reports.columns.unit),
        label("onHand", t.reports.columns.onHand, "integer"),
        label("cost", t.reports.columns.costPrice, "money"),
        label("salePrice", t.reports.columns.salePrice, "money"),
        label("value", t.reports.columns.atCost, "money"),
        label("retailValue", t.reports.columns.atSale, "money"),
        label("share", t.reports.columns.inventoryShare, "percent"),
      ],
      rows: [...inventoryRows]
        .sort((a, b) => b.value - a.value)
        .map((row) => ({
          sku: row.sku,
          name: row.name,
          type: labels.itemType[row.type] ?? row.type,
          unit: row.unit,
          onHand: row.onHand,
          cost: row.cost,
          salePrice: row.salePrice,
          value: row.value,
          retailValue: row.retailValue,
          share: round2(safePct(row.value, inventoryValue)),
        })),
    },
    {
      id: "low-stock",
      title: t.reports.reorder.title,
      description: t.reports.reorder.hint,
      columns: [
        label("sku", t.reports.columns.sku),
        label("name", t.reports.columns.itemName),
        label("type", t.reports.columns.itemType),
        label("unit", t.reports.columns.unit),
        label("onHand", t.reports.columns.available, "integer"),
        label("reorderPoint", t.reports.columns.reorderPoint, "integer"),
        label("reorderQty", t.reports.columns.reorderQuantity, "integer"),
        label("shortage", t.reports.columns.shortfall, "integer"),
        label("shortageValue", t.reports.columns.reorderValue, "money"),
        label("status", t.reports.columns.status),
      ],
      rows: lowStockRows.map((row) => ({
        sku: row.sku,
        name: row.name,
        type: labels.itemType[row.type] ?? row.type,
        unit: row.unit,
        onHand: row.onHand,
        reorderPoint: row.reorderPoint,
        reorderQty: row.reorderQty,
        shortage: row.shortage,
        shortageValue: round2(row.shortage * row.cost),
        status: stockStatusLabel(row.onHand, row.reorderPoint, t),
      })),
    },
    {
      id: "stock-by-warehouse",
      title: t.reports.byWarehouse.title,
      description: t.reports.byWarehouse.hint,
      columns: [
        label("code", t.reports.columns.warehouseCode),
        label("name", t.reports.columns.warehouseName),
        label("location", t.reports.columns.location),
        label("skus", t.reports.columns.itemCount, "integer"),
        label("qty", t.reports.columns.totalQuantity, "integer"),
        label("value", t.reports.columns.value, "money"),
        label("share", t.reports.columns.inventoryShare, "percent"),
      ],
      rows: warehouseRows.map((row) => ({
        code: row.code,
        name: row.name,
        location: row.location,
        skus: row.skus,
        qty: row.qty,
        value: row.value,
        share: round2(safePct(row.value, inventoryValue)),
      })),
    },
    {
      id: "sales-by-item",
      title: t.reports.salesByItem.title,
      description: t.reports.salesByItem.hint,
      columns: [
        label("sku", t.reports.columns.sku),
        label("name", t.reports.columns.itemName),
        label("unit", t.reports.columns.unit),
        label("unitsSold", t.reports.columns.unitsSold, "integer"),
        label("revenue", t.common.revenue, "money"),
        label("cogs", t.common.cost, "money"),
        label("profit", t.reports.columns.profit, "money"),
        label("margin", t.reports.columns.margin, "percent"),
        label("share", t.reports.columns.revenueShare, "percent"),
        label("avgPrice", t.reports.columns.avgPrice, "money"),
      ],
      rows: current.agg.productList.map((row) => ({
        sku: row.sku,
        name: row.name,
        unit: row.unit,
        unitsSold: row.unitsSold,
        revenue: round2(row.revenue),
        cogs: round2(row.cogs),
        profit: round2(row.profit),
        margin: round2(row.marginPct),
        share: round2(row.revenueSharePct),
        avgPrice: round2(row.avgSellingPrice),
      })),
    },
    {
      id: "sales-by-customer",
      title: t.reports.salesByCustomer.title,
      description: t.reports.salesByCustomer.hint,
      columns: [
        label("name", t.common.customer),
        label("orders", t.reports.columns.orderCount, "integer"),
        label("units", t.dashboard.units, "integer"),
        label("revenue", t.common.revenue, "money"),
        label("cost", t.common.cost, "money"),
        label("profit", t.reports.columns.profit, "money"),
        label("margin", t.reports.columns.margin, "percent"),
        label("share", t.reports.columns.revenueShare, "percent"),
      ],
      rows: current.agg.customerList.map((row) => ({
        name: row.name,
        orders: row.orderCount,
        units: row.units,
        revenue: round2(row.revenue),
        cost: round2(row.cost),
        profit: round2(row.profit),
        margin: round2(row.marginPct),
        share: round2(row.revenueSharePct),
      })),
    },
    {
      id: "purchases-by-supplier",
      title: t.reports.purchasesBySupplier.title,
      description: t.reports.purchasesBySupplier.hint,
      columns: [
        label("name", t.common.supplier),
        label("orders", t.reports.columns.orderCount, "integer"),
        label("purchases", t.dashboard.purchasesValue, "money"),
        label("share", t.reports.columns.purchaseShare, "percent"),
      ],
      rows: current.agg.supplierList.map((row) => ({
        name: row.name,
        orders: row.orderCount,
        purchases: round2(row.purchases),
        share: round2(row.sharePct),
      })),
    },
    statusSection("sales-order-status", t.reports.orderStatus.salesTitle, t.reports.orderStatus.salesHint, labels.sales, salesStatusMap),
    statusSection("purchase-order-status", t.reports.orderStatus.purchaseTitle, t.reports.orderStatus.purchaseHint, labels.purchase, purchaseStatusMap),
    {
      id: "sales-order-detail",
      title: t.reports.salesDetail.title,
      description: t.reports.salesDetail.hint,
      columns: [
        label("orderNumber", t.reports.columns.orderNumber),
        label("orderDate", t.reports.columns.orderDate, "date"),
        label("party", t.common.customer),
        label("status", t.reports.columns.status),
        label("lines", t.reports.columns.lineCount, "integer"),
        label("qty", t.reports.columns.qty, "integer"),
        label("value", t.reports.columns.orderValue, "money"),
      ],
      rows: salesDetail.map((row) => ({
        orderNumber: row.orderNumber,
        orderDate: row.orderDate,
        party: row.party,
        status: labels.sales[row.status] ?? row.status,
        lines: row.lines,
        qty: row.qty,
        value: row.value,
      })),
    },
    {
      id: "purchase-order-detail",
      title: t.reports.purchaseDetail.title,
      description: t.reports.purchaseDetail.hint,
      columns: [
        label("orderNumber", t.reports.columns.orderNumber),
        label("orderDate", t.reports.columns.orderDate, "date"),
        label("party", t.common.supplier),
        label("status", t.reports.columns.status),
        label("lines", t.reports.columns.lineCount, "integer"),
        label("qty", t.reports.columns.qty, "integer"),
        label("value", t.reports.columns.orderValue, "money"),
      ],
      rows: purchaseDetail.map((row) => ({
        orderNumber: row.orderNumber,
        orderDate: row.orderDate,
        party: row.party,
        status: labels.purchase[row.status] ?? row.status,
        lines: row.lines,
        qty: row.qty,
        value: row.value,
      })),
    },
    {
      id: "work-orders",
      title: t.reports.workOrders.title,
      description: t.reports.workOrders.hint,
      columns: [
        label("orderNumber", t.reports.columns.workOrderNumber),
        label("item", t.reports.columns.itemColumn),
        label("sku", t.reports.columns.sku),
        label("warehouse", t.reports.columns.warehouseColumn),
        label("status", t.reports.columns.status),
        label("quantity", t.reports.columns.qty, "integer"),
        label("startDate", t.reports.columns.startDate, "date"),
        label("dueDate", t.reports.columns.dueDate, "date"),
        label("completedAt", t.reports.columns.completedAt, "date"),
      ],
      rows: workOrders.map((row) => ({
        orderNumber: row.orderNumber,
        item: row.item.name,
        sku: row.item.sku,
        warehouse: row.warehouse.name,
        status: labels.workOrder[row.status] ?? row.status,
        quantity: row.quantity,
        startDate: row.startDate,
        dueDate: row.dueDate,
        completedAt: row.completedAt,
      })),
    },
    {
      id: "period-performance",
      title: t.reports.performance.title,
      description: t.reports.performance.hint,
      columns: [
        label("period", t.reports.columns.period),
        label("salesOrders", t.common.salesOrders, "integer"),
        label("unitsSold", t.reports.columns.unitsSold, "integer"),
        label("revenue", t.common.revenue, "money"),
        label("cogs", t.common.cost, "money"),
        label("profit", t.reports.columns.profit, "money"),
        label("margin", t.reports.columns.margin, "percent"),
        label("purchases", t.dashboard.purchasesValue, "money"),
        label("netCashFlow", t.reports.columns.netCashFlow, "money"),
        label("productionQty", t.reports.columns.producedQty, "integer"),
        label("labPassed", t.reports.columns.testsPassed, "integer"),
        label("labTotal", t.reports.columns.totalTests, "integer"),
      ],
      rows: trendRows,
    },
    {
      id: "lab-summary",
      title: t.reports.lab.title,
      description: t.reports.lab.hint,
      columns: [
        label("category", t.reports.columns.category),
        label("total", t.reports.columns.totalTests, "integer"),
        label("pass", t.reports.columns.pass, "integer"),
        label("review", t.reports.columns.review, "integer"),
        label("fail", t.reports.columns.fail, "integer"),
        label("passRate", t.reports.columns.passRate, "percent"),
      ],
      rows: [...labCategoryMap.entries()]
        .map(([category, entry]) => ({
          category: labels.labCategory[category] ?? category,
          total: entry.total,
          pass: entry.pass,
          review: entry.review,
          fail: entry.fail,
          passRate: round2(safePct(entry.pass, entry.total)),
        }))
        .sort((a, b) => b.total - a.total),
    },
    {
      id: "lab-tests",
      title: t.reports.labDetail.title,
      description: t.reports.labDetail.hint,
      columns: [
        label("testedAt", t.reports.columns.testDate, "date"),
        label("category", t.reports.columns.category),
        label("material", t.reports.columns.material),
        label("testName", t.reports.columns.test),
        label("result", t.reports.columns.result, "decimal"),
        label("unit", t.reports.columns.unit),
        label("standard", t.reports.columns.standard),
        label("limits", t.reports.columns.allowedRange),
        label("status", t.reports.columns.status),
      ],
      rows: labTests.map((row) => ({
        testedAt: row.testedAt,
        category: labels.labCategory[row.category] ?? row.category,
        material: row.material,
        testName: row.testName,
        result: row.result,
        unit: row.unit,
        standard: row.standard,
        limits: row.minValue === null && row.maxValue === null
          ? "—"
          : `${row.minValue ?? "−∞"} — ${row.maxValue ?? "+∞"}`,
        status: labels.lab[row.status] ?? row.status,
      })),
    },
  ];

  return {
    title: t.reports.reportTitle,
    rangeLabel: formatRangeLabel(range),
    from: range.from,
    to: range.to,
    generatedAt: new Date(),
    currency: DEFAULT_CURRENCY,
    metrics,
    sections,
  };
}
import { db } from "@/lib/db";
import { buildWindow } from "@/lib/dashboard-metrics";
import {
  DateRange, bucketKey, bucketLabel, createEmptyBuckets, eachBucket,
  formatRangeLabel, previousPeriod,
} from "@/lib/date-range";
import { DEFAULT_CURRENCY, formatDate, formatMoney, formatNumber, formatPercent, percentChange } from "@/lib/utils";

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

export const REPORT_TITLE = "تقرير شامل — نظام التصنيع المتكامل";

const ITEM_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: "مواد خام",
  COMPONENT: "مكونات",
  FINISHED_GOOD: "منتجات نهائية",
  CONSUMABLE: "مستهلكات",
};

const SALES_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  CONFIRMED: "مؤكد",
  FULFILLED: "منفذ",
  CANCELLED: "ملغى",
};

const PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة",
  ORDERED: "تم الطلب",
  RECEIVED: "تم استلامه",
  CANCELLED: "ملغى",
};

const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط",
  RELEASED: "مُعتمد",
  IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتمل",
  CANCELLED: "ملغى",
};

const LAB_STATUS_LABELS: Record<string, string> = {
  PASS: "مطابق",
  REVIEW: "قيد المراجعة",
  FAIL: "غير مطابق",
};

const LAB_CATEGORY_LABELS: Record<string, string> = {
  cement: "أسمنت",
  "aggregate-physical": "ركام — خواص فيزيائية",
  water: "مياه",
  fresh: "الخلطة الطازجة",
  block: "بلوك",
  brick: "طوب",
  paver: "إنترلوك",
  hardened: "خرسانة متصلدة",
};

const GRANULARITY_LABELS: Record<string, string> = { day: "يومي", week: "أسبوعي", month: "شهري" };

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
      return formatNumber(Number(value), 0, "ar-EG");
    case "decimal":
      return formatNumber(Number(value), 2, "ar-EG");
    case "date":
      return value instanceof Date ? formatDate(value) : String(value);
    default:
      return String(value);
  }
}

function label(key: string, text: string, kind: ReportColumnKind = "text"): ReportColumn {
  return { key, label: text, kind };
}

function stockStatusLabel(onHand: number, reorderPoint: number) {
  if (onHand === 0) return "نفد المخزون";
  if (reorderPoint > 0 && onHand <= reorderPoint / 2) return "حرج — يحتاج توريد عاجل";
  return "منخفض — عند حد إعادة الطلب";
}

export async function getReportSuite(range: DateRange): Promise<ReportSuite> {
  const prev = previousPeriod(range);

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
        label("status", "الحالة"),
        label("count", "عدد الطلبات", "integer"),
        label("value", "القيمة", "money"),
        label("share", "الحصة", "percent"),
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
      period: bucketLabel(date, range.granularity),
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
    { id: "revenue", label: "إجمالي الإيرادات", value: window.revenue, kind: "money", deltaPct: percentChange(window.revenue, prevWindow.revenue), hint: `${window.salesOrderCount} طلب بيع` },
    { id: "cogs", label: "تكلفة البضاعة المباعة", value: window.cogs, kind: "money", deltaPct: percentChange(window.cogs, prevWindow.cogs), hint: `${window.unitsSold} وحدة مباعة` },
    { id: "grossProfit", label: "مجمل الربح", value: window.grossProfit, kind: "money", deltaPct: percentChange(window.grossProfit, prevWindow.grossProfit), hint: `${formatPercent(window.grossMarginPct)} من الإيرادات` },
    { id: "purchases", label: "قيمة المشتريات", value: window.purchases, kind: "money", deltaPct: percentChange(window.purchases, prevWindow.purchases), hint: `${window.purchaseOrderCount} طلب شراء` },
    { id: "netCashFlow", label: "صافي التدفق النقدي", value: window.netCashFlow, kind: "money", deltaPct: percentChange(window.netCashFlow, prevWindow.netCashFlow), hint: `تحصيل ${formatPercent(window.cashConversionPct)}` },
    { id: "inventoryValue", label: "قيمة المخزون", value: inventoryValue, kind: "money", deltaPct: null, hint: `${inventoryRows.length} صنف` },
    { id: "lowStock", label: "أصناف تحت إعادة الطلب", value: lowStockRows.length, kind: "integer", deltaPct: null, hint: "بحاجة إلى توريد" },
    { id: "productionQty", label: "الكمية المُنتجة", value: window.productionQty, kind: "integer", deltaPct: percentChange(window.productionQty, prevWindow.productionQty), hint: `${window.completedWorkOrders} أمر إنتاج مكتمل` },
    { id: "labPassRate", label: "نسبة نجاح اختبارات المعمل", value: window.labPassRatePct, kind: "percent", deltaPct: percentChange(window.labPassRatePct, prevWindow.labPassRatePct), hint: `${window.labPassed} من ${window.labTotal}` },
    { id: "avgOrderValue", label: "متوسط قيمة طلب البيع", value: window.avgOrderValue, kind: "money", deltaPct: percentChange(window.avgOrderValue, prevWindow.avgOrderValue), hint: `${window.distinctCustomers} عميل` },
  ];

  const sections: ReportSection[] = [
    {
      id: "inventory-valuation",
      title: "تقييم المخزون",
      description: `قيمة الأرصدة الحالية بالتكلفة وسعر البيع وحصة كل صنف من إجمالي المخزون (${formatRangeLabel(range)})`,
      columns: [
        label("sku", "رمز الصنف"),
        label("name", "اسم الصنف"),
        label("type", "النوع"),
        label("unit", "الوحدة"),
        label("onHand", "الرصيد الحالي", "integer"),
        label("cost", "سعر التكلفة", "money"),
        label("salePrice", "سعر البيع", "money"),
        label("value", "قيمة المخزون بالتكلفة", "money"),
        label("retailValue", "قيمة المخزون بسعر البيع", "money"),
        label("share", "الحصة من المخزون", "percent"),
      ],
      rows: [...inventoryRows]
        .sort((a, b) => b.value - a.value)
        .map((row) => ({
          sku: row.sku,
          name: row.name,
          type: ITEM_TYPE_LABELS[row.type] ?? row.type,
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
      title: "تقرير المخزون المنخفض",
      description: "الأصناف عند نقطة إعادة الطلب المحددة أو أقل مع حجم العجز وقيمة التوريد المطلوبة",
      columns: [
        label("sku", "رمز الصنف"),
        label("name", "اسم الصنف"),
        label("type", "النوع"),
        label("unit", "الوحدة"),
        label("onHand", "المتاح", "integer"),
        label("reorderPoint", "نقطة إعادة الطلب", "integer"),
        label("reorderQty", "كمية إعادة الطلب", "integer"),
        label("shortage", "العجز", "integer"),
        label("shortageValue", "قيمة التوريد المطلوبة", "money"),
        label("status", "الحالة"),
      ],
      rows: lowStockRows.map((row) => ({
        sku: row.sku,
        name: row.name,
        type: ITEM_TYPE_LABELS[row.type] ?? row.type,
        unit: row.unit,
        onHand: row.onHand,
        reorderPoint: row.reorderPoint,
        reorderQty: row.reorderQty,
        shortage: row.shortage,
        shortageValue: round2(row.shortage * row.cost),
        status: stockStatusLabel(row.onHand, row.reorderPoint),
      })),
    },
    {
      id: "stock-by-warehouse",
      title: "المخزون حسب المستودع",
      description: "توزيع الأرصدة وقيمتها على مواقع التخزين",
      columns: [
        label("code", "رمز المستودع"),
        label("name", "اسم المستودع"),
        label("location", "الموقع"),
        label("skus", "عدد الأصناف", "integer"),
        label("qty", "إجمالي الكمية", "integer"),
        label("value", "قيمة المخزون", "money"),
        label("share", "الحصة من المخزون", "percent"),
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
      title: "المبيعات والربحية حسب الصنف",
      description: "الإيراد والتكلفة والربح والهامش لكل صنف خلال الفترة المختارة",
      columns: [
        label("sku", "رمز الصنف"),
        label("name", "اسم الصنف"),
        label("unit", "الوحدة"),
        label("unitsSold", "الوحدات المباعة", "integer"),
        label("revenue", "الإيراد", "money"),
        label("cogs", "التكلفة", "money"),
        label("profit", "الربح", "money"),
        label("margin", "الهامش", "percent"),
        label("share", "حصة الإيراد", "percent"),
        label("avgPrice", "متوسط سعر البيع", "money"),
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
      title: "أداء العملاء",
      description: "عدد الطلبات والإيراد والربح وحصة كل عميل خلال الفترة المختارة",
      columns: [
        label("name", "العميل"),
        label("orders", "عدد الطلبات", "integer"),
        label("units", "الوحدات", "integer"),
        label("revenue", "الإيراد", "money"),
        label("cost", "التكلفة", "money"),
        label("profit", "الربح", "money"),
        label("margin", "الهامش", "percent"),
        label("share", "الحصة من الإيراد", "percent"),
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
      title: "أداء الموردين",
      description: "عدد أوامر الشراء وقيمة المشتريات وحصة كل مورد خلال الفترة المختارة",
      columns: [
        label("name", "المورد"),
        label("orders", "عدد الأوامر", "integer"),
        label("purchases", "قيمة المشتريات", "money"),
        label("share", "الحصة من المشتريات", "percent"),
      ],
      rows: current.agg.supplierList.map((row) => ({
        name: row.name,
        orders: row.orderCount,
        purchases: round2(row.purchases),
        share: round2(row.sharePct),
      })),
    },
    statusSection("sales-order-status", "طلبات البيع حسب الحالة", "توزيع طلبات البيع على حالاتها مع قيمة كل حالة", SALES_STATUS_LABELS, salesStatusMap),
    statusSection("purchase-order-status", "طلبات الشراء حسب الحالة", "توزيع طلبات الشراء على حالاتها مع قيمة كل حالة", PURCHASE_STATUS_LABELS, purchaseStatusMap),
    {
      id: "sales-order-detail",
      title: "تفاصيل طلبات البيع",
      description: "كل طلبات البيع المسجلة خلال الفترة المختارة",
      columns: [
        label("orderNumber", "رقم الطلب"),
        label("orderDate", "تاريخ الطلب", "date"),
        label("party", "العميل"),
        label("status", "الحالة"),
        label("lines", "عدد البنود", "integer"),
        label("qty", "الكمية", "integer"),
        label("value", "قيمة الطلب", "money"),
      ],
      rows: salesDetail.map((row) => ({
        orderNumber: row.orderNumber,
        orderDate: row.orderDate,
        party: row.party,
        status: SALES_STATUS_LABELS[row.status] ?? row.status,
        lines: row.lines,
        qty: row.qty,
        value: row.value,
      })),
    },
    {
      id: "purchase-order-detail",
      title: "تفاصيل طلبات الشراء",
      description: "كل طلبات الشراء المسجلة خلال الفترة المختارة",
      columns: [
        label("orderNumber", "رقم الطلب"),
        label("orderDate", "تاريخ الطلب", "date"),
        label("party", "المورد"),
        label("status", "الحالة"),
        label("lines", "عدد البنود", "integer"),
        label("qty", "الكمية", "integer"),
        label("value", "قيمة الطلب", "money"),
      ],
      rows: purchaseDetail.map((row) => ({
        orderNumber: row.orderNumber,
        orderDate: row.orderDate,
        party: row.party,
        status: PURCHASE_STATUS_LABELS[row.status] ?? row.status,
        lines: row.lines,
        qty: row.qty,
        value: row.value,
      })),
    },
    {
      id: "work-orders",
      title: "أوامر الإنتاج",
      description: "أوامر الإنتاج التي بدأت أو استحققت أو اكتملت خلال الفترة المختارة",
      columns: [
        label("orderNumber", "رقم الأمر"),
        label("item", "الصنف"),
        label("sku", "رمز الصنف"),
        label("warehouse", "المستودع"),
        label("status", "الحالة"),
        label("quantity", "الكمية", "integer"),
        label("startDate", "تاريخ البدء", "date"),
        label("dueDate", "تاريخ الاستحقاق", "date"),
        label("completedAt", "تاريخ الإكمال", "date"),
      ],
      rows: workOrders.map((row) => ({
        orderNumber: row.orderNumber,
        item: row.item.name,
        sku: row.item.sku,
        warehouse: row.warehouse.name,
        status: WORK_ORDER_STATUS_LABELS[row.status] ?? row.status,
        quantity: row.quantity,
        startDate: row.startDate,
        dueDate: row.dueDate,
        completedAt: row.completedAt,
      })),
    },
    {
      id: "period-performance",
      title: "الأداء خلال الزمن",
      description: `تجميع ${GRANULARITY_LABELS[range.granularity]} للمبيعات والمشتريات والإنتاج ونتائج المعمل`,
      columns: [
        label("period", "الفترة"),
        label("salesOrders", "طلبات البيع", "integer"),
        label("unitsSold", "الوحدات المباعة", "integer"),
        label("revenue", "الإيراد", "money"),
        label("cogs", "التكلفة", "money"),
        label("profit", "الربح", "money"),
        label("margin", "الهامش", "percent"),
        label("purchases", "المشتريات", "money"),
        label("netCashFlow", "صافي التدفق النقدي", "money"),
        label("productionQty", "الكمية المُنتجة", "integer"),
        label("labPassed", "اختبارات ناجحة", "integer"),
        label("labTotal", "إجمالي الاختبارات", "integer"),
      ],
      rows: trendRows,
    },
    {
      id: "lab-summary",
      title: "ملخص نتائج المعمل",
      description: "عدد الاختبارات وتوزيعها بين المطابق وقيد المراجعة وغير المطابق لكل تصنيف",
      columns: [
        label("category", "التصنيف"),
        label("total", "إجمالي الاختبارات", "integer"),
        label("pass", "مطابق", "integer"),
        label("review", "قيد المراجعة", "integer"),
        label("fail", "غير مطابق", "integer"),
        label("passRate", "نسبة النجاح", "percent"),
      ],
      rows: [...labCategoryMap.entries()]
        .map(([category, entry]) => ({
          category: LAB_CATEGORY_LABELS[category] ?? category,
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
      title: "تفاصيل اختبارات المعمل",
      description: "كل الاختبارات المسجلة خلال الفترة المختارة مع النتائج والمعايير المرجعية",
      columns: [
        label("testedAt", "تاريخ الاختبار", "date"),
        label("category", "التصنيف"),
        label("material", "المادة"),
        label("testName", "الاختبار"),
        label("result", "النتيجة", "decimal"),
        label("unit", "الوحدة"),
        label("standard", "المعيار"),
        label("limits", "الحد المسموح"),
        label("status", "الحالة"),
      ],
      rows: labTests.map((row) => ({
        testedAt: row.testedAt,
        category: LAB_CATEGORY_LABELS[row.category] ?? row.category,
        material: row.material,
        testName: row.testName,
        result: row.result,
        unit: row.unit,
        standard: row.standard,
        limits: row.minValue === null && row.maxValue === null
          ? "—"
          : `${row.minValue ?? "−∞"} — ${row.maxValue ?? "+∞"}`,
        status: LAB_STATUS_LABELS[row.status] ?? row.status,
      })),
    },
  ];

  return {
    title: REPORT_TITLE,
    rangeLabel: formatRangeLabel(range),
    from: range.from,
    to: range.to,
    generatedAt: new Date(),
    currency: DEFAULT_CURRENCY,
    metrics,
    sections,
  };
}
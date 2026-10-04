import { db } from "@/lib/db";
import {
  BucketValue, DateRange, bucketKey, bucketLabel, createEmptyBuckets,
  eachBucket, formatRangeLabel, previousPeriod,
} from "@/lib/date-range";
import { percentChange } from "@/lib/utils";

const ACTIVE_SALES_STATUSES = ["DRAFT", "CONFIRMED", "FULFILLED"] as const;
const ACTIVE_PURCHASE_STATUSES = ["DRAFT", "ORDERED", "RECEIVED"] as const;

export type WindowMetrics = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  purchases: number;
  netCashFlow: number;
  cashConversionPct: number;
  salesOrderCount: number;
  purchaseOrderCount: number;
  avgOrderValue: number;
  unitsSold: number;
  productionQty: number;
  completedWorkOrders: number;
  labTotal: number;
  labPassed: number;
  labPassRatePct: number;
  distinctCustomers: number;
  grossProfitPerUnit: number;
};

export type DeltaMetric = {
  current: number;
  previous: number;
  delta: number | null;
  deltaPct: number | null;
};

export type ProductPerformanceRow = {
  sku: string;
  name: string;
  unit: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  revenueSharePct: number;
  profitSharePct: number;
  avgSellingPrice: number;
};

export type CustomerPerformanceRow = {
  name: string;
  orderCount: number;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
  revenueSharePct: number;
};

export type SupplierPerformanceRow = {
  name: string;
  orderCount: number;
  purchases: number;
  sharePct: number;
};

export type TrendPoint = BucketValue & {
  key: string;
  label: string;
  marginPct: number;
  cashFlow: number;
  salesSharePct: number;
  purchaseSharePct: number;
};

export type DashboardMetrics = {
  range: DateRange;
  rangeLabel: string;
  prevRange: { from: Date; to: Date };
  window: WindowMetrics;
  previous: WindowMetrics;
  deltas: Record<keyof WindowMetrics, DeltaMetric>;
  trend: TrendPoint[];
  productShare: { name: string; share: number; revenue: number; units: number }[];
  customerShare: { name: string; share: number; revenue: number; profit: number }[];
  products: ProductPerformanceRow[];
  customers: CustomerPerformanceRow[];
  suppliers: SupplierPerformanceRow[];
  salesByStatus: { status: string; label: string; count: number; value: number }[];
  purchaseByStatus: { status: string; label: string; count: number; value: number }[];
  inventory: {
    totalValue: number;
    skuCount: number;
    totalUnits: number;
    lowStockCount: number;
    lowStockValue: number;
    topByValue: { sku: string; name: string; qty: number; value: number; sharePct: number }[];
  };
};

const SALES_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", CONFIRMED: "مؤكد", FULFILLED: "منفذ", CANCELLED: "ملغى",
};
const PURCHASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", ORDERED: "تم الطلب", RECEIVED: "تم استلامه", CANCELLED: "ملغى",
};
const WORK_ORDER_STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط", RELEASED: "مُعتمد", IN_PROGRESS: "قيد التنفيذ",
  COMPLETED: "مكتمل", CANCELLED: "ملغى",
};
const ITEM_TYPE_LABELS: Record<string, string> = {
  RAW_MATERIAL: "مواد خام", COMPONENT: "مكونات", FINISHED_GOOD: "منتجات نهائية", CONSUMABLE: "مستهلكات",
};

export const DASHBOARD_STATUS_LABELS = {
  sales: SALES_STATUS_LABELS,
  purchase: PURCHASE_STATUS_LABELS,
  workOrder: WORK_ORDER_STATUS_LABELS,
  itemType: ITEM_TYPE_LABELS,
};

type SalesLine = {
  quantity: number;
  unitPrice: number;
  costPrice: number;
  itemId: string;
  sku: string;
  name: string;
  unit: string;
};

type PurchaseLine = {
  quantity: number;
  unitCost: number;
  itemId: string;
  sku: string;
  name: string;
};

type SalesRecord = {
  orderNumber: string;
  status: string;
  orderDate: Date;
  customerName: string;
  lines: SalesLine[];
};

type PurchaseRecord = {
  orderNumber: string;
  status: string;
  orderDate: Date;
  supplierName: string;
  lines: PurchaseLine[];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const safePct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * COGS prefers SalesOrderLine.unitCost, frozen onto the line when the order was
 * fulfilled, and falls back to Item.costPrice only for lines that never fulfilled.
 * So editing an item's cost moves the margin of open orders but leaves closed ones
 * reported as they actually were.
 */
async function loadSales(from: Date, to: Date): Promise<SalesRecord[]> {
  const orders = await db.salesOrder.findMany({
    where: { orderDate: { gte: from, lte: to }, status: { in: [...ACTIVE_SALES_STATUSES] } },
    orderBy: { orderDate: "asc" },
    include: {
      customer: { select: { name: true } },
      lines: { include: { item: { select: { sku: true, name: true, unit: true, costPrice: true } } } },
    },
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    orderDate: order.orderDate,
    customerName: order.customer.name,
    lines: order.lines.map((line) => ({
      quantity: line.quantity,
      unitPrice: Number(line.unitPrice),
      costPrice: Number(line.unitCost ?? line.item.costPrice),
      itemId: line.itemId,
      sku: line.item.sku,
      name: line.item.name,
      unit: line.item.unit,
    })),
  }));
}

async function loadPurchases(from: Date, to: Date): Promise<PurchaseRecord[]> {
  const orders = await db.purchaseOrder.findMany({
    where: { orderDate: { gte: from, lte: to }, status: { in: [...ACTIVE_PURCHASE_STATUSES] } },
    orderBy: { orderDate: "asc" },
    include: {
      supplier: { select: { name: true } },
      lines: { include: { item: { select: { sku: true, name: true } } } },
    },
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    orderDate: order.orderDate,
    supplierName: order.supplier.name,
    lines: order.lines.map((line) => ({
      quantity: line.quantity,
      unitCost: Number(line.unitCost),
      itemId: line.itemId,
      sku: line.item.sku,
      name: line.item.name,
    })),
  }));
}

function aggregate(orders: SalesRecord[], purchases: PurchaseRecord[]) {
  let revenue = 0;
  let cogs = 0;
  let unitsSold = 0;
  const customerNames = new Set<string>();

  const byItem = new Map<string, ProductPerformanceRow>();
  const byCustomer = new Map<string, CustomerPerformanceRow>();
  const bySupplier = new Map<string, SupplierPerformanceRow>();

  for (const order of orders) {
    let orderRevenue = 0;
    let orderCost = 0;
    let orderUnits = 0;

    for (const line of order.lines) {
      const lineRevenue = line.quantity * line.unitPrice;
      const lineCost = line.quantity * line.costPrice;

      revenue += lineRevenue;
      cogs += lineCost;
      unitsSold += line.quantity;
      orderRevenue += lineRevenue;
      orderCost += lineCost;
      orderUnits += line.quantity;

      const existing = byItem.get(line.itemId) ?? {
        sku: line.sku, name: line.name, unit: line.unit, unitsSold: 0,
        revenue: 0, cogs: 0, profit: 0, marginPct: 0, revenueSharePct: 0,
        profitSharePct: 0, avgSellingPrice: 0,
      };
      existing.unitsSold += line.quantity;
      existing.revenue += lineRevenue;
      existing.cogs += lineCost;
      byItem.set(line.itemId, existing);
    }

    customerNames.add(order.customerName);

    const customer = byCustomer.get(order.customerName) ?? {
      name: order.customerName, orderCount: 0, units: 0,
      revenue: 0, cost: 0, profit: 0, marginPct: 0, revenueSharePct: 0,
    };
    customer.orderCount += 1;
    customer.units += orderUnits;
    customer.revenue += orderRevenue;
    customer.cost += orderCost;
    customer.profit += orderRevenue - orderCost;
    byCustomer.set(order.customerName, customer);
  }

  let purchaseTotal = 0;
  for (const order of purchases) {
    let orderTotal = 0;
    for (const line of order.lines) {
      const lineTotal = line.quantity * line.unitCost;
      purchaseTotal += lineTotal;
      orderTotal += lineTotal;
    }
    const supplier = bySupplier.get(order.supplierName) ?? { name: order.supplierName, orderCount: 0, purchases: 0, sharePct: 0 };
    supplier.orderCount += 1;
    supplier.purchases += orderTotal;
    bySupplier.set(order.supplierName, supplier);
  }

  const grossProfit = revenue - cogs;
  const totalProfit = sum([...byItem.values()].map((item) => item.revenue - item.cogs));

  const products = [...byItem.values()]
    .map((item) => ({
      ...item,
      profit: item.revenue - item.cogs,
      marginPct: safePct(item.revenue - item.cogs, item.revenue),
      revenueSharePct: safePct(item.revenue, revenue),
      profitSharePct: safePct(item.revenue - item.cogs, totalProfit),
      avgSellingPrice: item.unitsSold > 0 ? item.revenue / item.unitsSold : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const customers = [...byCustomer.values()]
    .map((customer) => ({
      ...customer,
      marginPct: safePct(customer.profit, customer.revenue),
      revenueSharePct: safePct(customer.revenue, revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const suppliers = [...bySupplier.values()]
    .map((supplier) => ({ ...supplier, sharePct: safePct(supplier.purchases, purchaseTotal) }))
    .sort((a, b) => b.purchases - a.purchases);

  return {
    revenue, cogs, grossProfit, unitsSold, purchaseTotal,
    customerNames, customerList: customers, productList: products, supplierList: suppliers,
  };
}

/**
 * One fully-aggregated window: KPIs plus the unsliced per-item / per-customer /
 * per-supplier lists. Exported so the reports suite can reuse the exact same
 * aggregation instead of recomputing it.
 */
export async function buildWindow(range: DateRange) {
  const [sales, purchases, workOrders, labRecords] = await Promise.all([
    loadSales(range.from, range.to),
    loadPurchases(range.from, range.to),
    db.workOrder.findMany({
      where: { OR: [{ startDate: { gte: range.from, lte: range.to } }, { completedAt: { gte: range.from, lte: range.to } }] },
      select: { quantity: true, status: true, completedAt: true, startDate: true },
    }),
    db.labTestRecord.findMany({
      where: { testedAt: { gte: range.from, lte: range.to } },
      select: { status: true },
    }),
  ]);

  const agg = aggregate(sales, purchases);

  const completed = workOrders.filter((wo) => wo.status === "COMPLETED");
  const productionQty = sum(completed.map((wo) => wo.quantity));
  const labPassed = labRecords.filter((record) => record.status === "PASS").length;

  const metrics: WindowMetrics = {
    revenue: round2(agg.revenue),
    cogs: round2(agg.cogs),
    grossProfit: round2(agg.grossProfit),
    grossMarginPct: round2(safePct(agg.grossProfit, agg.revenue)),
    purchases: round2(agg.purchaseTotal),
    netCashFlow: round2(agg.revenue - agg.purchaseTotal),
    cashConversionPct: round2(safePct(agg.revenue, agg.purchaseTotal)),
    salesOrderCount: sales.length,
    purchaseOrderCount: purchases.length,
    avgOrderValue: round2(agg.revenue / Math.max(1, sales.length)),
    unitsSold: agg.unitsSold,
    productionQty,
    completedWorkOrders: completed.length,
    labTotal: labRecords.length,
    labPassed,
    labPassRatePct: round2(safePct(labPassed, labRecords.length)),
    distinctCustomers: agg.customerNames.size,
    grossProfitPerUnit: agg.unitsSold > 0 ? round2(agg.grossProfit / agg.unitsSold) : 0,
  };

  return { metrics, sales, purchases, agg };
}

function buildTrend(
  range: DateRange,
  sales: SalesRecord[],
  purchases: PurchaseRecord[],
  productionQtyByKey: Map<string, number>,
  labByKey: Map<string, { total: number; passed: number }>,
): TrendPoint[] {
  const buckets = createEmptyBuckets(range);

  for (const order of sales) {
    const key = bucketKey(order.orderDate, range.granularity);
    const bucket = buckets[key];
    if (!bucket) continue;
    bucket.salesOrders += 1;
    for (const line of order.lines) {
      const revenue = line.quantity * line.unitPrice;
      const cost = line.quantity * line.costPrice;
      bucket.revenue += revenue;
      bucket.cogs += cost;
      bucket.unitsSold += line.quantity;
    }
  }

  for (const order of purchases) {
    const key = bucketKey(order.orderDate, range.granularity);
    const bucket = buckets[key];
    if (!bucket) continue;
    bucket.purchaseOrders += 1;
    for (const line of order.lines) bucket.purchases += line.quantity * line.unitCost;
  }

  for (const [key, qty] of productionQtyByKey) {
    if (buckets[key]) buckets[key].productionQty += qty;
  }
  for (const [key, lab] of labByKey) {
    if (!buckets[key]) continue;
    buckets[key].labTotal += lab.total;
    buckets[key].labPassed += lab.passed;
  }

  const totalRevenue = sum(Object.values(buckets).map((bucket) => bucket.revenue));
  const totalPurchases = sum(Object.values(buckets).map((bucket) => bucket.purchases));

  return eachBucket(range.from, range.to, range.granularity).map((date) => {
    const key = bucketKey(date, range.granularity);
    const bucket = buckets[key];
    const profit = bucket.revenue - bucket.cogs;
    return {
      ...bucket,
      key,
      label: bucketLabel(date, range.granularity),
      profit: round2(profit),
      revenue: round2(bucket.revenue),
      cogs: round2(bucket.cogs),
      purchases: round2(bucket.purchases),
      marginPct: round2(safePct(profit, bucket.revenue)),
      cashFlow: round2(bucket.revenue - bucket.purchases),
      salesSharePct: round2(safePct(bucket.revenue, totalRevenue)),
      purchaseSharePct: round2(safePct(bucket.purchases, totalPurchases)),
    };
  });
}

export async function getEarliestRecordDate() {
  const [sales, purchases] = await Promise.all([
    db.salesOrder.findFirst({ orderBy: { orderDate: "asc" }, select: { orderDate: true } }),
    db.purchaseOrder.findFirst({ orderBy: { orderDate: "asc" }, select: { orderDate: true } }),
  ]);
  const dates = [sales?.orderDate, purchases?.orderDate].filter((d): d is Date => Boolean(d));
  return dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : undefined;
}

export async function getDashboardMetrics(range: DateRange): Promise<DashboardMetrics> {
  const prev = previousPeriod(range);

  const [current, previous, statusGroups, purchaseStatusGroups, workOrderStatus, inventoryItems, production, lab] =
    await Promise.all([
      buildWindow(range),
      buildWindow({ ...prev, days: range.days, granularity: range.granularity }),
      db.salesOrder.groupBy({ by: ["status"], _count: { _all: true }, where: { orderDate: { gte: range.from, lte: range.to } } }),
      db.purchaseOrder.groupBy({ by: ["status"], _count: { _all: true }, where: { orderDate: { gte: range.from, lte: range.to } } }),
      db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      db.item.findMany({ where: { isActive: true }, select: { sku: true, name: true, reorderPoint: true, costPrice: true, stockLevels: { select: { quantity: true } } } }),
      db.workOrder.findMany({
        where: { status: "COMPLETED", completedAt: { gte: range.from, lte: range.to } },
        select: { quantity: true, completedAt: true },
      }),
      db.labTestRecord.findMany({
        where: { testedAt: { gte: range.from, lte: range.to } },
        select: { testedAt: true, status: true },
      }),
    ]);

  const productionQtyByKey = new Map<string, number>();
  for (const wo of production) {
    if (!wo.completedAt) continue;
    const key = bucketKey(wo.completedAt, range.granularity);
    productionQtyByKey.set(key, (productionQtyByKey.get(key) ?? 0) + wo.quantity);
  }

  const labByKey = new Map<string, { total: number; passed: number }>();
  for (const record of lab) {
    const key = bucketKey(record.testedAt, range.granularity);
    const entry = labByKey.get(key) ?? { total: 0, passed: 0 };
    entry.total += 1;
    if (record.status === "PASS") entry.passed += 1;
    labByKey.set(key, entry);
  }

  const trend = buildTrend(range, current.sales, current.purchases, productionQtyByKey, labByKey);

  const deltas = Object.keys(current.metrics).reduce((acc, key) => {
    const metricKey = key as keyof WindowMetrics;
    const currentValue = current.metrics[metricKey];
    const previousValue = previous.metrics[metricKey];
    acc[metricKey] = {
      current: currentValue,
      previous: previousValue,
      delta: round2(currentValue - previousValue),
      deltaPct: percentChange(currentValue, previousValue),
    };
    return acc;
  }, {} as Record<keyof WindowMetrics, DeltaMetric>);

  const revenueByStatus = new Map<string, number>();
  for (const order of current.sales) {
    const total = sum(order.lines.map((line) => line.quantity * line.unitPrice));
    revenueByStatus.set(order.status, (revenueByStatus.get(order.status) ?? 0) + total);
  }
  const purchaseByStatusValue = new Map<string, number>();
  for (const order of current.purchases) {
    const total = sum(order.lines.map((line) => line.quantity * line.unitCost));
    purchaseByStatusValue.set(order.status, (purchaseByStatusValue.get(order.status) ?? 0) + total);
  }

  const inventoryRows = inventoryItems.map((item) => {
    const qty = sum(item.stockLevels.map((level) => level.quantity));
    return { sku: item.sku, name: item.name, qty, value: qty * Number(item.costPrice), low: qty <= item.reorderPoint };
  });
  const inventoryValue = sum(inventoryRows.map((row) => row.value));

  const salesByStatus = statusGroups.map((group) => ({
    status: group.status,
    label: SALES_STATUS_LABELS[group.status] ?? group.status,
    count: group._count._all,
    value: round2(revenueByStatus.get(group.status) ?? 0),
  }));

  const purchaseByStatus = purchaseStatusGroups.map((group) => ({
    status: group.status,
    label: PURCHASE_STATUS_LABELS[group.status] ?? group.status,
    count: group._count._all,
    value: round2(purchaseByStatusValue.get(group.status) ?? 0),
  }));

  const topByValue = [...inventoryRows]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((row) => ({ ...row, sharePct: round2(safePct(row.value, inventoryValue)) }));

  return {
    range,
    rangeLabel: formatRangeLabel(range),
    prevRange: prev,
    window: current.metrics,
    previous: previous.metrics,
    deltas,
    trend,
    productShare: current.agg.productList.slice(0, 8).map((product) => ({
      name: product.name,
      share: product.revenueSharePct,
      revenue: round2(product.revenue),
      units: product.unitsSold,
    })),
    customerShare: current.agg.customerList.slice(0, 8).map((customer) => ({
      name: customer.name,
      share: customer.revenueSharePct,
      revenue: round2(customer.revenue),
      profit: round2(customer.profit),
    })),
    products: current.agg.productList.slice(0, 12),
    customers: current.agg.customerList.slice(0, 10),
    suppliers: current.agg.supplierList.slice(0, 8),
    salesByStatus,
    purchaseByStatus,
    inventory: {
      totalValue: round2(inventoryValue),
      skuCount: inventoryRows.length,
      totalUnits: sum(inventoryRows.map((row) => row.qty)),
      lowStockCount: inventoryRows.filter((row) => row.low).length,
      lowStockValue: round2(sum(inventoryRows.filter((row) => row.low).map((row) => row.value))),
      topByValue,
    },
  };
}

export async function getOperationalSnapshot() {
  const [workOrderStatus, items] = await Promise.all([
    db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    db.item.findMany({
      where: { isActive: true },
      select: { type: true, stockLevels: { select: { quantity: true } } },
    }),
  ]);

  const byType = Object.keys(ITEM_TYPE_LABELS).map((type) => ({
    key: type,
    type: ITEM_TYPE_LABELS[type],
    qty: sum(items.filter((item) => item.type === type).flatMap((item) => item.stockLevels.map((level) => level.quantity))),
    skus: items.filter((item) => item.type === type).length,
  }));

  return {
    workOrderStatus: workOrderStatus.map((group) => ({
      key: group.status,
      status: WORK_ORDER_STATUS_LABELS[group.status] ?? group.status,
      count: group._count._all,
    })),
    byType,
  };
}

export function emptyWindow(): WindowMetrics {
  return {
    revenue: 0, cogs: 0, grossProfit: 0, grossMarginPct: 0, purchases: 0, netCashFlow: 0,
    cashConversionPct: 0, salesOrderCount: 0, purchaseOrderCount: 0, avgOrderValue: 0,
    unitsSold: 0, productionQty: 0, completedWorkOrders: 0, labTotal: 0, labPassed: 0,
    labPassRatePct: 0, distinctCustomers: 0, grossProfitPerUnit: 0,
  };
}

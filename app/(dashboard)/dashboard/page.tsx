import {
  Package, Factory, ShoppingCart, Truck, Wallet, TrendingUp, Percent,
  Receipt, Users, Coins, Boxes, AlertTriangle, FlaskConical,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CashFlowChart, InventoryByTypeChart, MarginTrendChart, OutputVsSalesChart,
  ProfitMarginGauge, ProfitabilityTrendChart, PurchaseShareChart, SalesShareByCustomerChart,
  SalesShareByProductChart, WorkOrderStatusChart,
} from "@/components/shared/dashboard-charts";
import { DateRangeFilter } from "@/components/shared/date-range-filter";
import { KpiCard, type KpiCardProps } from "@/components/shared/kpi-card";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { DateRangeParams, formatRangeLabel, resolveDateRange } from "@/lib/date-range";
import { getDashboardMetrics, getEarliestRecordDate, getOperationalSnapshot } from "@/lib/dashboard-metrics";
import { DEFAULT_CURRENCY, formatMoney, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const money = (value: number) => formatMoney(value, DEFAULT_CURRENCY);

export default async function DashboardPage({
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

  const [metrics, snapshot, openSalesOrders, openPurchaseOrders] = await Promise.all([
    getDashboardMetrics(range),
    getOperationalSnapshot(),
    db.salesOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } }),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED"] } } }),
  ]);

  const d = metrics.deltas;

  const financialKpis: KpiCardProps[] = [
    {
      label: "إجمالي الإيرادات",
      value: money(metrics.window.revenue),
      icon: "wallet",
      deltaPct: d.revenue.deltaPct,
      footer: `${formatNumber(metrics.window.salesOrderCount, 0, "ar-EG")} طلب بيع · متوسط الطلب ${money(metrics.window.avgOrderValue)}`,
    },
    {
      label: "تكلفة البضاعة المباعة",
      value: money(metrics.window.cogs),
      icon: "receipt",
      deltaPct: d.cogs.deltaPct,
      tone: "inverse",
      footer: `تم بيع ${formatNumber(metrics.window.unitsSold, 0, "ar-EG")} وحدة`,
    },
    {
      label: "مجمل الربح",
      value: money(metrics.window.grossProfit),
      icon: "trendingUp",
      deltaPct: d.grossProfit.deltaPct,
      footer: `ربح للوحدة ${money(metrics.window.grossProfitPerUnit)}`,
    },
    {
      label: "نسبة الربح الإجمالية",
      value: formatPercent(metrics.window.grossMarginPct),
      icon: "percent",
      deltaPct: d.grossMarginPct.deltaPct,
      footer: `الفترة السابقة ${formatPercent(metrics.previous.grossMarginPct)}`,
    },
  ];

  const cashKpis: KpiCardProps[] = [
    {
      label: "قيمة المشتريات",
      value: money(metrics.window.purchases),
      icon: "shoppingCart",
      deltaPct: d.purchases.deltaPct,
      tone: "inverse",
      footer: `${formatNumber(metrics.window.purchaseOrderCount, 0, "ar-EG")} طلب شراء`,
    },
    {
      label: "صافي التدفق النقدي",
      value: money(metrics.window.netCashFlow),
      icon: "coins",
      deltaPct: d.netCashFlow.deltaPct,
      footer: `تحصيل ${formatPercent(metrics.window.cashConversionPct)} من المشتريات`,
    },
    {
      label: "قيمة المخزون الحالية",
      value: money(metrics.inventory.totalValue),
      icon: "boxes",
      footer: `${formatNumber(metrics.inventory.skuCount, 0, "ar-EG")} صنف · ${formatNumber(metrics.inventory.totalUnits, 0, "ar-EG")} وحدة`,
    },
    {
      label: "أصناف تحت نقطة إعادة الطلب",
      value: formatNumber(metrics.inventory.lowStockCount, 0, "ar-EG"),
      icon: "alertTriangle",
      footer: `بقيمة ${money(metrics.inventory.lowStockValue)}`,
    },
  ];

  const operationalKpis: KpiCardProps[] = [
    {
      label: "طلبات بيع مفتوحة",
      value: formatNumber(openSalesOrders, 0, "ar-EG"),
      icon: "shoppingCart",
      hint: "مسودة + مؤكدة (كل الفترات)",
    },
    {
      label: "طلبات شراء مفتوحة",
      value: formatNumber(openPurchaseOrders, 0, "ar-EG"),
      icon: "truck",
      hint: "مسودة + تم الطلب (كل الفترات)",
    },
    {
      label: "الكمية المُنتجة",
      value: formatNumber(metrics.window.productionQty, 0, "ar-EG"),
      icon: "factory",
      deltaPct: d.productionQty.deltaPct,
      footer: `${formatNumber(metrics.window.completedWorkOrders, 0, "ar-EG")} أمر إنتاج مكتمل`,
    },
    {
      label: "نسبة نجاح اختبارات المعمل",
      value: formatPercent(metrics.window.labPassRatePct),
      icon: "lab",
      deltaPct: d.labPassRatePct.deltaPct,
      footer: `${formatNumber(metrics.window.labPassed, 0, "ar-EG")} من ${formatNumber(metrics.window.labTotal, 0, "ar-EG")} اختبار`,
    },
  ];

  return (
    <div className="space-y-6">
      <OfflineBanner />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground">
            <span>تحليل مالي وتشغيلي تفصيلي للمصنع</span>{" — "}
            <span className="tabular-nums">{formatRangeLabel(range)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">العملة: {DEFAULT_CURRENCY}</Badge>
          <Badge variant="outline">الفترة السابقة للمقارنة متاحة</Badge>
        </div>
      </div>

      <DateRangeFilter fallbackFrom={earliest?.toISOString()} />

      <section className="space-y-3">
        <SectionHeading title="المؤشرات المالية" description="الإيرادات والتكاليف والربح خلال الفترة المختارة" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {financialKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cashKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ProfitMarginGauge
          marginPct={metrics.window.grossMarginPct}
          profit={metrics.window.grossProfit}
          revenue={metrics.window.revenue}
        />
        <div className="lg:col-span-2">
          <ProfitabilityTrendChart data={metrics.trend} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <MarginTrendChart data={metrics.trend} target={metrics.window.grossMarginPct} />
        <CashFlowChart data={metrics.trend} />
      </section>

      <section className="space-y-3">
        <SectionHeading title="نسب المساهمة في المبيعات" description="توزيع الإيرادات على الأصناف والعملاء والموردين" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SalesShareByProductChart data={metrics.productShare} />
          <SalesShareByCustomerChart data={metrics.customerShare} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>تحليل الربحية حسب الصنف</CardTitle>
          <CardDescription>الإيراد والتكلفة والربح ونسبة المساهمة لكل صنف في الفترة المختارة</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              لا توجد مبيعات في الفترة المختارة. جرّب توسيع نطاق التاريخ.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الصنف</TableHead>
                    <TableHead>الوحدات</TableHead>
                    <TableHead>الإيراد</TableHead>
                    <TableHead>التكلفة</TableHead>
                    <TableHead>الربح</TableHead>
                    <TableHead>الهامش</TableHead>
                    <TableHead>حصة الإيراد</TableHead>
                    <TableHead>متوسط سعر البيع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.products.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{product.sku}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatNumber(product.unitsSold, 0, "ar-EG")} {product.unit}</TableCell>
                      <TableCell className="tabular-nums font-medium">{money(product.revenue)}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{money(product.cogs)}</TableCell>
                      <TableCell className={cnProfit(product.profit)}>{money(product.profit)}</TableCell>
                      <TableCell>
                        <MarginBadge value={product.marginPct} />
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, product.revenueSharePct)}%` }} />
                          </div>
                          <span className="tabular-nums text-xs">{formatPercent(product.revenueSharePct)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">{money(product.avgSellingPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>أداء العملاء</CardTitle>
            <CardDescription>الإيراد والربح وحصة كل عميل</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.customers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد عملاء في الفترة المختارة.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العميل</TableHead>
                      <TableHead>الطلبات</TableHead>
                      <TableHead>الإيراد</TableHead>
                      <TableHead>الربح</TableHead>
                      <TableHead>الهامش</TableHead>
                      <TableHead>الحصة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.customers.map((customer) => (
                      <TableRow key={customer.name}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            {customer.name}
                          </div>
                        </TableCell>
                        <TableCell className="tabular-nums">{formatNumber(customer.orderCount, 0, "ar-EG")}</TableCell>
                        <TableCell className="tabular-nums">{money(customer.revenue)}</TableCell>
                        <TableCell className={cnProfit(customer.profit)}>{money(customer.profit)}</TableCell>
                        <TableCell><MarginBadge value={customer.marginPct} /></TableCell>
                        <TableCell className="tabular-nums">{formatPercent(customer.revenueSharePct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أداء الموردين</CardTitle>
            <CardDescription>قيمة المشتريات وحصة كل مورد</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.suppliers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مشتريات في الفترة المختارة.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المورد</TableHead>
                      <TableHead>الطلبات</TableHead>
                      <TableHead>قيمة المشتريات</TableHead>
                      <TableHead>الحصة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.suppliers.map((supplier) => (
                      <TableRow key={supplier.name}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(supplier.orderCount, 0, "ar-EG")}</TableCell>
                        <TableCell className="tabular-nums">{money(supplier.purchases)}</TableCell>
                        <TableCell className="tabular-nums">{formatPercent(supplier.sharePct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeading title="مؤشرات تشغيلية" description="الإنتاج والمخزون وحالات الطلبات" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {operationalKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <WorkOrderStatusChart data={snapshot.workOrderStatus} />
          <InventoryByTypeChart data={snapshot.byType} />
          <Card>
            <CardHeader>
              <CardTitle>حالات طلبات البيع</CardTitle>
              <CardDescription>توزيع الطلبات وقيمتها خلال الفترة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.salesByStatus.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات في الفترة المختارة.</p>
              ) : metrics.salesByStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={status.status === "CANCELLED" ? "destructive" : "secondary"}>{status.label}</Badge>
                    <span className="tabular-nums text-xs text-muted-foreground">{formatNumber(status.count, 0, "ar-EG")} طلب</span>
                  </span>
                  <span className="tabular-nums font-medium">{money(status.value)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <OutputVsSalesChart data={metrics.trend} />
        <PurchaseShareChart data={metrics.suppliers} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>أعلى الأصناف قيمة في المخزون</CardTitle>
          <CardDescription>قيمة المخزون بالتكلفة وحصة كل صنف</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الصنف</TableHead>
                  <TableHead>الكمية</TableHead>
                  <TableHead>قيمة المخزون</TableHead>
                  <TableHead>الحصة من المخزون</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.inventory.topByValue.map((row) => (
                  <TableRow key={row.sku}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{row.name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{row.sku}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatNumber(row.qty, 0, "ar-EG")}</TableCell>
                    <TableCell className="tabular-nums font-medium">{money(row.value)}</TableCell>
                    <TableCell className="tabular-nums">{formatPercent(row.sharePct)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function cnProfit(value: number) {
  return `tabular-nums font-medium ${value < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`;
}

function MarginBadge({ value }: { value: number }) {
  if (value >= 25) return <Badge variant="success">{formatPercent(value)}</Badge>;
  if (value >= 10) return <Badge variant="warning">{formatPercent(value)}</Badge>;
  if (value < 0) return <Badge variant="destructive">{formatPercent(value)}</Badge>;
  return <Badge variant="secondary">{formatPercent(value)}</Badge>;
}

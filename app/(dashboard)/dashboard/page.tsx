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
import { getServerI18n } from "@/lib/i18n-server";
import { DEFAULT_CURRENCY, formatMoney, formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

const money = (value: number) => formatMoney(value, DEFAULT_CURRENCY);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { t } = await getServerI18n();
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
    getDashboardMetrics(range, t),
    getOperationalSnapshot(t),
    db.salesOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } }),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED"] } } }),
  ]);

  const d = metrics.deltas;

  const financialKpis: KpiCardProps[] = [
    {
      label: t.dashboard.revenue,
      value: money(metrics.window.revenue),
      icon: "wallet",
      deltaPct: d.revenue.deltaPct,
      footer: t.dashboard.revenueFooter(formatNumber(metrics.window.salesOrderCount, 0), money(metrics.window.avgOrderValue)),
    },
    {
      label: t.dashboard.cogs,
      value: money(metrics.window.cogs),
      icon: "receipt",
      deltaPct: d.cogs.deltaPct,
      tone: "inverse",
      footer: t.dashboard.cogsFooter(formatNumber(metrics.window.unitsSold, 0)),
    },
    {
      label: t.dashboard.grossProfit,
      value: money(metrics.window.grossProfit),
      icon: "trendingUp",
      deltaPct: d.grossProfit.deltaPct,
      footer: t.dashboard.grossProfitFooter(money(metrics.window.grossProfitPerUnit)),
    },
    {
      label: t.dashboard.grossMargin,
      value: formatPercent(metrics.window.grossMarginPct),
      icon: "percent",
      deltaPct: d.grossMarginPct.deltaPct,
      footer: t.dashboard.previousPeriod(formatPercent(metrics.previous.grossMarginPct)),
    },
  ];

  const cashKpis: KpiCardProps[] = [
    {
      label: t.dashboard.purchasesValue,
      value: money(metrics.window.purchases),
      icon: "shoppingCart",
      deltaPct: d.purchases.deltaPct,
      tone: "inverse",
      footer: t.dashboard.purchasesFooter(formatNumber(metrics.window.purchaseOrderCount, 0)),
    },
    {
      label: t.dashboard.netCashFlow,
      value: money(metrics.window.netCashFlow),
      icon: "coins",
      deltaPct: d.netCashFlow.deltaPct,
      footer: t.dashboard.netCashFlowFooter(formatPercent(metrics.window.cashConversionPct)),
    },
    {
      label: t.dashboard.inventoryValue,
      value: money(metrics.inventory.totalValue),
      icon: "boxes",
      footer: t.dashboard.inventoryValueFooter(
        formatNumber(metrics.inventory.skuCount, 0),
        formatNumber(metrics.inventory.totalUnits, 0),
      ),
    },
    {
      label: t.dashboard.lowStockItems,
      value: formatNumber(metrics.inventory.lowStockCount, 0),
      icon: "alertTriangle",
      footer: t.dashboard.lowStockFooter(money(metrics.inventory.lowStockValue)),
    },
  ];

  const operationalKpis: KpiCardProps[] = [
    {
      label: t.dashboard.openSalesOrders,
      value: formatNumber(openSalesOrders, 0),
      icon: "shoppingCart",
      hint: t.dashboard.openSalesOrdersHint,
    },
    {
      label: t.dashboard.openPurchaseOrders,
      value: formatNumber(openPurchaseOrders, 0),
      icon: "truck",
      hint: t.dashboard.openPurchaseOrdersHint,
    },
    {
      label: t.dashboard.producedQty,
      value: formatNumber(metrics.window.productionQty, 0),
      icon: "factory",
      deltaPct: d.productionQty.deltaPct,
      footer: t.dashboard.producedFooter(formatNumber(metrics.window.completedWorkOrders, 0)),
    },
    {
      label: t.dashboard.labPassRate,
      value: formatPercent(metrics.window.labPassRatePct),
      icon: "lab",
      deltaPct: d.labPassRatePct.deltaPct,
      footer: t.dashboard.labPassRateFooter(
        formatNumber(metrics.window.labPassed, 0),
        formatNumber(metrics.window.labTotal, 0),
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <OfflineBanner />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.dashboard}</h1>
          <p className="text-sm text-muted-foreground">
            <span>{t.dashboard.tagline}</span>{" — "}
            <span className="tabular-nums">{formatRangeLabel(range)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <Badge variant="outline">{t.dashboard.currency}: {DEFAULT_CURRENCY}</Badge>
          <Badge variant="outline">{t.dashboard.previousAvailable}</Badge>
        </div>
      </div>

      <DateRangeFilter fallbackFrom={earliest?.toISOString()} />

      <section className="space-y-3">
        <SectionHeading title={t.dashboard.financialSection} description={t.dashboard.financialSectionHint} />
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
        <SectionHeading title={t.dashboard.shareSection} description={t.dashboard.shareSectionHint} />
        <div className="grid gap-4 lg:grid-cols-2">
          <SalesShareByProductChart data={metrics.productShare} />
          <SalesShareByCustomerChart data={metrics.customerShare} />
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.productProfitTitle}</CardTitle>
          <CardDescription>{t.dashboard.productProfitHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.dashboard.noSalesInRange}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.item}</TableHead>
                    <TableHead>{t.dashboard.units}</TableHead>
                    <TableHead>{t.common.revenue}</TableHead>
                    <TableHead>{t.common.cost}</TableHead>
                    <TableHead>{t.dashboard.profit}</TableHead>
                    <TableHead>{t.dashboard.margin}</TableHead>
                    <TableHead>{t.dashboard.revenueShare}</TableHead>
                    <TableHead>{t.dashboard.avgSellingPrice}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.products.map((product) => (
                    <TableRow key={product.sku}>
                      <TableCell>
                        <div className="font-medium">{product.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{product.sku}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatNumber(product.unitsSold, 0)} {product.unit}</TableCell>
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
<CardTitle>{t.dashboard.customerPerformanceTitle}</CardTitle>
          <CardDescription>{t.dashboard.customerPerformanceHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.customers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.dashboard.noCustomersInRange}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.customer}</TableHead>
                    <TableHead>{t.dashboard.orders}</TableHead>
                    <TableHead>{t.common.revenue}</TableHead>
                    <TableHead>{t.dashboard.profit}</TableHead>
                    <TableHead>{t.dashboard.margin}</TableHead>
                    <TableHead>{t.common.share}</TableHead>
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
                        <TableCell className="tabular-nums">{formatNumber(customer.orderCount, 0)}</TableCell>
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
<CardTitle>{t.dashboard.supplierPerformanceTitle}</CardTitle>
          <CardDescription>{t.dashboard.supplierPerformanceHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics.suppliers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.dashboard.noPurchasesInRange}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.supplier}</TableHead>
                    <TableHead>{t.dashboard.orders}</TableHead>
                    <TableHead>{t.dashboard.purchasesValue}</TableHead>
                    <TableHead>{t.common.share}</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {metrics.suppliers.map((supplier) => (
                      <TableRow key={supplier.name}>
                        <TableCell className="font-medium">{supplier.name}</TableCell>
                        <TableCell className="tabular-nums">{formatNumber(supplier.orderCount, 0)}</TableCell>
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
        <SectionHeading title={t.dashboard.operationalSection} description={t.dashboard.operationalSectionHint} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {operationalKpis.map((kpi) => <KpiCard key={kpi.label} {...kpi} />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <WorkOrderStatusChart data={snapshot.workOrderStatus} />
          <InventoryByTypeChart data={snapshot.byType} />
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.salesStatusTitle}</CardTitle>
              <CardDescription>{t.dashboard.salesStatusHint}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.salesByStatus.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t.dashboard.noOrdersInRange}</p>
              ) : metrics.salesByStatus.map((status) => (
                <div key={status.status} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge variant={status.status === "CANCELLED" ? "destructive" : "secondary"}>{status.label}</Badge>
                    <span className="tabular-nums text-xs text-muted-foreground">{formatNumber(status.count, 0)} {t.dashboard.requests}</span>
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
          <CardTitle>{t.dashboard.topInventoryTitle}</CardTitle>
          <CardDescription>{t.dashboard.topInventoryHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.common.item}</TableHead>
                  <TableHead>{t.dashboard.inventoryQty}</TableHead>
                  <TableHead>{t.dashboard.inventoryValue}</TableHead>
                  <TableHead>{t.dashboard.inventoryShare}</TableHead>
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
                    <TableCell className="tabular-nums">{formatNumber(row.qty, 0)}</TableCell>
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

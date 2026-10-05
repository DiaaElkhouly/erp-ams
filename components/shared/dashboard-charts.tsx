"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, ReferenceLine,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DEFAULT_CURRENCY, formatCompact, formatMoney, formatPercent } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d"];
const REVENUE_COLOR = "#2563eb";
const COGS_COLOR = "#f59e0b";
const PROFIT_COLOR = "#16a34a";
const OUTFLOW_COLOR = "#dc2626";
const CASH_COLOR = "#0891b2";

const AXIS_FONT = { fontSize: 11 };

const moneyAxis = (label?: string) => ({
  tick: { fontSize: 11 },
  tickFormatter: (value: number) => formatCompact(value),
  ...(label ? { label: { value: label, angle: 0, position: "insideTop", style: { fontSize: 10, fill: "currentColor", opacity: 0.6 } } } : {}),
});

const moneyTooltip = {
  formatter: (value: unknown, name: string) => [formatMoney(Number(value), DEFAULT_CURRENCY), name] as [string, string],
};

const percentTooltip = {
  formatter: (value: unknown, name: string) => [formatPercent(Number(value)), name] as [string, string],
};

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export function WorkOrderStatusChart({ data }: { data: { status: string; count: number }[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.workOrderTitle}</CardTitle>
        <CardDescription>{t.charts.workOrderHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? <EmptyState message={t.charts.noWorkOrders} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryByTypeChart({ data }: { data: { type: string; qty: number }[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.inventoryByTypeTitle}</CardTitle>
        <CardDescription>{t.charts.inventoryByTypeHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="type" tick={AXIS_FONT} />
            <YAxis tick={AXIS_FONT} />
            <Tooltip />
            <Bar dataKey="qty" name={t.charts.units} fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export type FinancialTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  cogs: number;
  profit: number;
  marginPct: number;
  purchases: number;
  cashFlow: number;
  unitsSold: number;
  salesOrders: number;
  productionQty: number;
};

/** Revenue vs cost of goods vs gross profit across the selected buckets. */
export function ProfitabilityTrendChart({ data }: { data: FinancialTrendPoint[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.profitabilityTitle}</CardTitle>
        <CardDescription>{t.charts.profitabilityHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message={t.charts.noDataInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis yAxisId="money" {...moneyAxis()} />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="money" dataKey="revenue" name={t.charts.revenue} fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar yAxisId="money" dataKey="cogs" name={t.charts.cogs} fill={COGS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Line yAxisId="money" type="monotone" dataKey="profit" name={t.charts.grossProfit} stroke={PROFIT_COLOR} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function MarginTrendChart({ data, target }: { data: FinancialTrendPoint[]; target: number }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.marginTitle}</CardTitle>
        <CardDescription>{t.charts.marginHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message={t.charts.noDataInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis tick={AXIS_FONT} tickFormatter={(value: number) => `${formatCompact(value)}%`} unit="%" />
              <Tooltip {...percentTooltip} />
              <ReferenceLine y={target} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: t.charts.average(formatPercent(target)), fontSize: 10, position: "insideTopRight" }} />
              <Area type="monotone" dataKey="marginPct" name={t.charts.margin} stroke={PROFIT_COLOR} strokeWidth={2} fill={PROFIT_COLOR} fillOpacity={0.15} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Cash in (sales) vs cash out (purchases) and the resulting net position. */
export function CashFlowChart({ data }: { data: FinancialTrendPoint[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.cashFlowTitle}</CardTitle>
        <CardDescription>{t.charts.cashFlowHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message={t.charts.noDataInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis {...moneyAxis()} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId={0} dataKey="revenue" name={t.charts.cashIn} fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar yAxisId={0} dataKey="purchases" name={t.charts.cashOut} fill={OUTFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line yAxisId={0} type="monotone" dataKey="cashFlow" name={t.charts.netCashFlow} stroke={CASH_COLOR} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesVsPurchaseTrendChart({ data }: { data: FinancialTrendPoint[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.ordersOverviewTitle}</CardTitle>
        <CardDescription>{t.charts.ordersOverviewHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
            <YAxis tick={AXIS_FONT} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="salesOrders" name={t.charts.salesOrders} stroke={PROFIT_COLOR} strokeWidth={2} />
            <Line type="monotone" dataKey="purchases" name={t.charts.purchaseValue} stroke={COGS_COLOR} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Horizontal share-of-revenue bars, the clearest way to read a percentage split. */
export function SalesShareByProductChart({ data }: { data: { name: string; share: number; revenue: number; units: number }[] }) {
  const { t } = useI18n();
  const rows = data.map((row) => ({ ...row, shareLabel: formatPercent(row.share) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.productShareTitle}</CardTitle>
        <CardDescription>{t.charts.productShareHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {rows.length === 0 ? <EmptyState message={t.charts.noSalesInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={AXIS_FONT} tickFormatter={(value: number) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={150} tick={AXIS_FONT} />
              <Tooltip
                formatter={(value: unknown, _name, item) => [
                  formatPercent(Number((item?.payload as { share: number }).share)),
                  t.charts.revenueShareTooltip,
                ]}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="share" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesShareByCustomerChart({ data }: { data: { name: string; share: number; revenue: number; profit: number }[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.customerShareTitle}</CardTitle>
        <CardDescription>{t.charts.customerShareHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? <EmptyState message={t.charts.noSalesInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="revenue"
                nameKey="name"
                innerRadius="45%"
                outerRadius="75%"
                paddingAngle={2}
                label={({ percent }: { percent?: number }) => formatPercent((percent ?? 0) * 100, 0)}
                labelLine={false}
              >
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: unknown) => formatMoney(Number(value), DEFAULT_CURRENCY)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfitMarginGauge({ marginPct, profit, revenue }: { marginPct: number; profit: number; revenue: number }) {
  const { t } = useI18n();
  const clamped = Math.max(0, Math.min(100, marginPct));
  const data = [{ name: t.charts.margin, value: clamped }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.marginGaugeTitle}</CardTitle>
        <CardDescription>{t.charts.marginGaugeHint}</CardDescription>
      </CardHeader>
      <CardContent className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="95%" startAngle={210} endAngle={-30} barSize={18} data={data}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(148,163,184,0.25)" }} fill={PROFIT_COLOR} />
            <Tooltip formatter={() => [formatPercent(marginPct), t.charts.margin]} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-6">
          <span className="tabular-nums text-3xl font-semibold">{formatPercent(marginPct)}</span>
          <span className="text-xs text-muted-foreground">{t.charts.of(formatMoney(revenue, DEFAULT_CURRENCY))}</span>
          <span className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {t.charts.profitOf(formatMoney(profit, DEFAULT_CURRENCY))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Cost structure of the period: purchase value split by supplier. */
export function PurchaseShareChart({ data }: { data: { name: string; purchases: number; sharePct: number }[] }) {
  const { t } = useI18n();
  const rows = data.map((row) => ({ ...row, label: `${row.name}` }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.purchaseShareTitle}</CardTitle>
        <CardDescription>{t.charts.purchaseShareHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {rows.length === 0 ? <EmptyState message={t.charts.noPurchasesInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval={0} />
              <YAxis {...moneyAxis()} />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="purchases" name={t.charts.purchaseValue} fill={OUTFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Units produced vs units sold in the same bucket — the operational half of the story. */
export function OutputVsSalesChart({ data }: { data: FinancialTrendPoint[] }) {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.charts.outputVsSalesTitle}</CardTitle>
        <CardDescription>{t.charts.outputVsSalesHint}</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message={t.charts.noDataInRange} /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis tick={AXIS_FONT} tickFormatter={(value: number) => formatCompact(value)} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="productionQty" name={t.charts.completedOutput} fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="unitsSold" name={t.charts.unitsSold} fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

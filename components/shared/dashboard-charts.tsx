"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, ComposedChart, ReferenceLine,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { DEFAULT_CURRENCY, formatCompact, formatMoney, formatPercent } from "@/lib/utils";

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>أوامر الإنتاج حسب الحالة</CardTitle>
        <CardDescription>مسار الإنتاج الحالي</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {data.length === 0 ? <EmptyState message="لا توجد أوامر إنتاج." /> : (
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>المخزون المتاح حسب نوع الصنف</CardTitle>
        <CardDescription>إجمالي الوحدات في جميع المستودعات</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="type" tick={AXIS_FONT} />
            <YAxis tick={AXIS_FONT} />
            <Tooltip />
            <Bar dataKey="qty" name="الوحدات" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} />
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>تحليل الربحية عبر الزمن</CardTitle>
        <CardDescription>الإيرادات مقابل تكلفة البضاعة المباعة وصافي الربح</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message="لا توجد بيانات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis yAxisId="money" {...moneyAxis()} />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="money" dataKey="revenue" name="الإيرادات" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar yAxisId="money" dataKey="cogs" name="تكلفة المبيعات" fill={COGS_COLOR} radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Line yAxisId="money" type="monotone" dataKey="profit" name="مجمل الربح" stroke={PROFIT_COLOR} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function MarginTrendChart({ data, target }: { data: FinancialTrendPoint[]; target: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>هامش الربح %</CardTitle>
        <CardDescription>نسبة مجمل الربح إلى الإيرادات لكل فترة</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message="لا توجد بيانات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis tick={AXIS_FONT} tickFormatter={(value: number) => `${formatCompact(value)}%`} unit="%" />
              <Tooltip {...percentTooltip} />
              <ReferenceLine y={target} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: `المتوسط ${formatPercent(target)}`, fontSize: 10, position: "insideTopRight" }} />
              <Area type="monotone" dataKey="marginPct" name="هامش الربح" stroke={PROFIT_COLOR} strokeWidth={2} fill={PROFIT_COLOR} fillOpacity={0.15} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Cash in (sales) vs cash out (purchases) and the resulting net position. */
export function CashFlowChart({ data }: { data: FinancialTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>التدفق النقدي</CardTitle>
        <CardDescription>المقبوضات مقابل المدفوعات وصافي التدفق</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message="لا توجد بيانات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis {...moneyAxis()} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId={0} dataKey="revenue" name="مقبوضات" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar yAxisId={0} dataKey="purchases" name="مدفوعات" fill={OUTFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Line yAxisId={0} type="monotone" dataKey="cashFlow" name="صافي التدفق" stroke={CASH_COLOR} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function SalesVsPurchaseTrendChart({ data }: { data: FinancialTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>نظرة عامة على الطلبات</CardTitle>
        <CardDescription>طلبات البيع مقابل طلبات الشراء</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
            <YAxis tick={AXIS_FONT} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="salesOrders" name="طلبات البيع" stroke={PROFIT_COLOR} strokeWidth={2} />
            <Line type="monotone" dataKey="purchases" name="قيمة المشتريات" stroke={COGS_COLOR} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

/** Horizontal share-of-revenue bars, the clearest way to read a percentage split. */
export function SalesShareByProductChart({ data }: { data: { name: string; share: number; revenue: number; units: number }[] }) {
  const rows = data.map((row) => ({ ...row, shareLabel: formatPercent(row.share) }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>نسبة مساهمة الأصناف في المبيعات</CardTitle>
        <CardDescription>حصة كل صنف من إجمالي الإيرادات</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {rows.length === 0 ? <EmptyState message="لا توجد مبيعات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 32 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} tick={AXIS_FONT} tickFormatter={(value: number) => `${value}%`} />
              <YAxis type="category" dataKey="name" width={150} tick={AXIS_FONT} />
              <Tooltip
                formatter={(value: unknown, _name, item) => [
                  formatPercent(Number((item?.payload as { share: number }).share)),
                  "الحصة من الإيرادات",
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>توزيع المبيعات على العملاء</CardTitle>
        <CardDescription>حصة كل عميل من إجمالي الإيرادات</CardDescription>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? <EmptyState message="لا توجد مبيعات في الفترة المختارة." /> : (
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
  const clamped = Math.max(0, Math.min(100, marginPct));
  const data = [{ name: "هامش الربح", value: clamped }];

  return (
    <Card>
      <CardHeader>
        <CardTitle>نسبة الربح الإجمالية</CardTitle>
        <CardDescription>مجمل الربح مقسومًا على الإيرادات</CardDescription>
      </CardHeader>
      <CardContent className="relative h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="95%" startAngle={210} endAngle={-30} barSize={18} data={data}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "rgba(148,163,184,0.25)" }} fill={PROFIT_COLOR} />
            <Tooltip formatter={() => [formatPercent(marginPct), "هامش الربح"]} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-6">
          <span className="tabular-nums text-3xl font-semibold">{formatPercent(marginPct)}</span>
          <span className="text-xs text-muted-foreground">من {formatMoney(revenue, DEFAULT_CURRENCY)}</span>
          <span className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            ربح {formatMoney(profit, DEFAULT_CURRENCY)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Cost structure of the period: purchase value split by supplier. */
export function PurchaseShareChart({ data }: { data: { name: string; purchases: number; sharePct: number }[] }) {
  const rows = data.map((row) => ({ ...row, label: `${row.name}` }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>توزيع المشتريات على الموردين</CardTitle>
        <CardDescription>حصة كل مورد من إجمالي قيمة المشتريات</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {rows.length === 0 ? <EmptyState message="لا توجد مشتريات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval={0} />
              <YAxis {...moneyAxis()} />
              <Tooltip {...moneyTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="purchases" name="قيمة المشتريات" fill={OUTFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Units produced vs units sold in the same bucket — the operational half of the story. */
export function OutputVsSalesChart({ data }: { data: FinancialTrendPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>الإنتاج مقابل المبيعات</CardTitle>
        <CardDescription>الكميات المُنتجة والمُباعة في كل فترة</CardDescription>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <EmptyState message="لا توجد بيانات في الفترة المختارة." /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis dataKey="label" tick={AXIS_FONT} interval="preserveStartEnd" />
              <YAxis tick={AXIS_FONT} tickFormatter={(value: number) => formatCompact(value)} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="productionQty" name="إنتاج مكتمل" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="unitsSold" name="وحدات مباعة" fill={REVENUE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

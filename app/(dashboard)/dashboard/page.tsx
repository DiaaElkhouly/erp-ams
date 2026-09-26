import { Package, Factory, ShoppingCart, Truck } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  WorkOrderStatusChart, InventoryByTypeChart, OrdersTrendChart,
} from "@/components/shared/dashboard-charts";
import { formatCurrency } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "مخطط", RELEASED: "مُعتمد", IN_PROGRESS: "قيد التنفيذ", COMPLETED: "مكتمل", CANCELLED: "ملغى",
  RAW_MATERIAL: "مواد خام", COMPONENT: "مكونات", FINISHED_GOOD: "منتجات نهائية", CONSUMABLE: "مستهلكات",
};

async function getData() {
  const [itemCount, activeWorkOrders, openSalesOrders, openPurchaseOrders, items, workOrders, salesOrders, purchaseOrders] =
    await Promise.all([
      db.item.count({ where: { isActive: true } }),
      db.workOrder.count({ where: { status: { in: ["PLANNED", "RELEASED", "IN_PROGRESS"] } } }),
      db.salesOrder.count({ where: { status: { in: ["DRAFT", "CONFIRMED"] } } }),
      db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "ORDERED"] } } }),
      db.item.findMany({ include: { stockLevels: true } }),
      db.workOrder.groupBy({ by: ["status"], _count: { _all: true } }),
      db.salesOrder.findMany({ include: { lines: true }, orderBy: { orderDate: "desc" }, take: 6 }),
      db.purchaseOrder.findMany({ include: { lines: true }, orderBy: { orderDate: "desc" }, take: 6 }),
    ]);

  const revenue = salesOrders.reduce((sum, so) => sum + so.lines.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0), 0);

  const byType = ["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"].map((type) => ({
    type: STATUS_LABELS[type],
    qty: items.filter((i) => i.type === type).reduce((s, i) => s + i.stockLevels.reduce((ss, l) => ss + l.quantity, 0), 0),
  }));

  const statusChart = workOrders.map((w) => ({ status: STATUS_LABELS[w.status], count: w._count._all }));

  const trend = Array.from({ length: 6 }).map((_, i) => ({
    label: `Order ${i + 1}`,
    sales: Number(salesOrders[i]?.lines.reduce((s, l) => s + l.quantity * Number(l.unitPrice), 0) ?? 0),
    purchase: Number(purchaseOrders[i]?.lines.reduce((s, l) => s + l.quantity * Number(l.unitCost), 0) ?? 0),
  })).reverse();

  return { itemCount, activeWorkOrders, openSalesOrders, openPurchaseOrders, revenue, byType, statusChart, trend };
}

export default async function DashboardPage() {
  const data = await getData();

  const kpis = [
    { label: "الأصناف النشطة", value: data.itemCount.toLocaleString("ar-EG"), icon: Package },
    { label: "أوامر الإنتاج قيد التنفيذ", value: data.activeWorkOrders.toLocaleString("ar-EG"), icon: Factory },
    { label: "طلبات البيع المفتوحة", value: data.openSalesOrders.toLocaleString("ar-EG"), icon: ShoppingCart },
    { label: "طلبات الشراء المفتوحة", value: data.openPurchaseOrders.toLocaleString("ar-EG"), icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">لوحة التحكم</h1>
        <p className="text-sm text-muted-foreground">نظرة شاملة على الإنتاج والمخزون والمبيعات والمشتريات.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">قيمة مبيعات الطلبات (مسودة + مؤكدة)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(data.revenue)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WorkOrderStatusChart data={data.statusChart} />
        <InventoryByTypeChart data={data.byType} />
      </div>
      <OrdersTrendChart data={data.trend} />
    </div>
  );
}

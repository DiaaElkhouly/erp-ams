import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", CONFIRMED: "مؤكد", FULFILLED: "منفذ", CANCELLED: "ملغى", ORDERED: "تم الطلب", RECEIVED: "مستلم",
};

async function getReportData() {
  const items = await db.item.findMany({ include: { stockLevels: true }, where: { isActive: true } });
  const lowStock = items
    .map((i) => ({ ...i, onHand: i.stockLevels.reduce((s, l) => s + l.quantity, 0) }))
    .filter((i) => i.onHand <= i.reorderPoint)
    .sort((a, b) => a.onHand - b.onHand);

  const inventoryValue = items.reduce(
    (sum, i) => sum + i.stockLevels.reduce((s, l) => s + l.quantity, 0) * Number(i.costPrice), 0
  );

  const [salesByStatus, purchaseByStatus] = await Promise.all([
    db.salesOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    db.purchaseOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  return { lowStock, inventoryValue, salesByStatus, purchaseByStatus, totalSkus: items.length };
}

export default async function ReportsPage() {
  const data = await getReportData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">التقارير</h1>
        <p className="text-sm text-muted-foreground">ملخصات تشغيلية للمخزون والمبيعات والمشتريات.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">إجمالي قيمة المخزون</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{formatCurrency(data.inventoryValue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">الأصناف النشطة</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold">{data.totalSkus}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">أصناف تحت نقطة إعادة الطلب</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold text-destructive">{data.lowStock.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تقرير المخزون المنخفض</CardTitle>
          <CardDescription>الأصناف عند نقطة إعادة الطلب المحددة أو أقل</CardDescription>
        </CardHeader>
        <CardContent>
          {data.lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">مستويات المخزون كافية لجميع الأصناف.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>رمز الصنف</TableHead><TableHead>الاسم</TableHead><TableHead>المتاح</TableHead><TableHead>نقطة إعادة الطلب</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.lowStock.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.sku}</TableCell>
                    <TableCell>{i.name}</TableCell>
                    <TableCell className="font-semibold text-destructive">{i.onHand} {i.unit}</TableCell>
                    <TableCell>{i.reorderPoint}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>طلبات البيع حسب الحالة</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.salesByStatus.map((s) => <Badge key={s.status} variant="secondary">{STATUS_LABELS[s.status]}: {s._count._all}</Badge>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>طلبات الشراء حسب الحالة</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.purchaseByStatus.map((s) => <Badge key={s.status} variant="secondary">{STATUS_LABELS[s.status]}: {s._count._all}</Badge>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

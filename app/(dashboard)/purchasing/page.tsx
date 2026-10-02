"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary", ORDERED: "default", RECEIVED: "success", CANCELLED: "destructive",
};
const STATUS_FLOW: Record<string, string | null> = {
  DRAFT: "ORDERED", ORDERED: "RECEIVED", RECEIVED: null, CANCELLED: null,
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", ORDERED: "تم الطلب", RECEIVED: "مستلم", CANCELLED: "ملغى",
};

function usePurchaseOrders() {
  return useQuery({ queryKey: ["purchase-orders"], queryFn: () => fetch("/api/purchase-orders").then((r) => r.json()) });
}
function useSuppliers() {
  return useQuery({ queryKey: ["suppliers"], queryFn: () => fetch("/api/suppliers").then((r) => r.json()) });
}
function useItemsList() {
  return useQuery({ queryKey: ["items", ""], queryFn: () => fetch("/api/items?pageSize=200").then((r) => r.json()) });
}

function NewSupplierDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/suppliers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      .then(async (r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("تمت إضافة المورد"); setOpen(false); setForm({ name: "", email: "", phone: "", address: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> مورد جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة مورد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={isPending || !form.name} onClick={() => mutate()}>{isPending ? "جارٍ الحفظ..." : "حفظ المورد"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPurchaseOrderDialog() {
  const [open, setOpen] = useState(false);
  const { data: supData } = useSuppliers();
  const { data: itemsData } = useItemsList();
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState([{ itemId: "", quantity: 1, unitCost: 0 }]);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/purchase-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierId, lines: lines.filter((l) => l.itemId) }),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); toast.success("تم إنشاء طلب الشراء"); setOpen(false); setSupplierId(""); setLines([{ itemId: "", quantity: 1, unitCost: 0 }]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filledLines = lines.filter((l) => l.itemId);
  const orderTotal = filledLines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> طلب شراء جديد</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>إنشاء طلب شراء</DialogTitle>
          <DialogDescription>حدّد المورد ثم أضف بنود الطلب مع الكمية وسعر الشراء.</DialogDescription>
        </DialogHeader>

        {/* Long orders scroll inside the dialog instead of stretching it past the viewport. */}
        <div className="-mx-1 max-h-[55vh] space-y-5 overflow-y-auto px-1">
          <div className="grid gap-1.5">
            <Label htmlFor="purchase-order-supplier">المورد</Label>
            <NativeSelect
              id="purchase-order-supplier"
              className="w-full"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">اختر المورد...</option>
              {supData?.suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>بنود الطلب</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { itemId: "", quantity: 1, unitCost: 0 }])}
              >
                <Plus className="h-3.5 w-3.5" /> إضافة بند
              </Button>
            </div>

            {/* The select column is minmax(0,1fr) and the select itself carries min-w-0:
                a native <select> is sized by its widest <option>, so without both it
                refuses to shrink and spills outside the dialog. */}
            <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] items-center gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid">
              <span>الصنف</span>
              <span className="text-center">الكمية</span>
              <span className="text-center">سعر الشراء</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] sm:border-0 sm:p-0"
                >
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">الصنف</span>
                    <NativeSelect
                      className="w-full min-w-0"
                      aria-label={`الصنف ${i + 1}`}
                      value={line.itemId}
                      onChange={(e) => {
                        const item = itemsData?.items.find((it: any) => it.id === e.target.value);
                        setLines(lines.map((l, j) => j === i ? { ...l, itemId: e.target.value, unitCost: item ? Number(item.costPrice) : 0 } : l));
                      }}
                    >
                      <option value="">اختر الصنف...</option>
                      {itemsData?.items.map((it: any) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">الكمية</span>
                    <Input
                      type="number"
                      min={1}
                      aria-label={`الكمية ${i + 1}`}
                      className="w-full text-center"
                      value={line.quantity}
                      onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, quantity: Number(e.target.value) } : l))}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">سعر الشراء</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={`سعر الشراء ${i + 1}`}
                      className="w-full text-center"
                      value={line.unitCost}
                      onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, unitCost: Number(e.target.value) } : l))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end text-muted-foreground hover:text-destructive sm:justify-self-center"
                    disabled={lines.length === 1}
                    aria-label={`حذف البند ${i + 1}`}
                    onClick={() => setLines(lines.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">البنود المكتملة</span>
              <span className="text-sm font-medium tabular-nums">{filledLines.length} من {lines.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">إجمالي الطلب</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(orderTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isPending || !supplierId || filledLines.length === 0}
            onClick={() => mutate()}
          >
            {isPending ? "جارٍ الحفظ..." : "إنشاء الطلب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function OrdersTab() {
  const { data, isLoading } = usePurchaseOrders();
  const qc = useQueryClient();
  const { mutate: advance } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/purchase-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); qc.invalidateQueries({ queryKey: ["items"] }); toast.success("تم تحديث الحالة"); },
  });
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/purchase-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["purchase-orders"] }); toast.success("تم حذف الطلب"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewPurchaseOrderDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الطلب</TableHead><TableHead>المورد</TableHead><TableHead>التاريخ</TableHead>
            <TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead className="w-32" />
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
            {!isLoading && data?.purchaseOrders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground"><Truck className="mx-auto mb-2 h-6 w-6" /> لا توجد طلبات شراء بعد.</TableCell></TableRow>
            )}
            {data?.purchaseOrders.map((po: any) => {
              const total = po.lines.reduce((s: number, l: any) => s + l.quantity * Number(l.unitCost), 0);
              const next = STATUS_FLOW[po.status];
              return (
                <TableRow key={po.id}>
                  <TableCell className="font-mono text-xs">{po.orderNumber}</TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>{formatDate(po.orderDate)}</TableCell>
                  <TableCell>{formatCurrency(total)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[po.status]}>{STATUS_LABELS[po.status]}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {next && <Button size="sm" variant="outline" onClick={() => advance({ id: po.id, status: next })}>نقل إلى {STATUS_LABELS[next]}</Button>}
                    <Button variant="ghost" size="icon" onClick={() => remove(po.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SuppliersTab() {
  const { data, isLoading } = useSuppliers();
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewSupplierDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد الإلكتروني</TableHead><TableHead>الهاتف</TableHead><TableHead>العنوان</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
            {data?.suppliers.map((s: any) => (
              <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.email || "—"}</TableCell><TableCell>{s.phone || "—"}</TableCell><TableCell>{s.address || "—"}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function PurchasingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">المشتريات</h1>
        <p className="text-sm text-muted-foreground">إدارة الموردين وطلبات الشراء.</p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="suppliers">الموردون</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

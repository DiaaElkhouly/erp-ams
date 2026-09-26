"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary", CONFIRMED: "default", FULFILLED: "success", CANCELLED: "destructive",
};
const STATUS_FLOW: Record<string, string | null> = {
  DRAFT: "CONFIRMED", CONFIRMED: "FULFILLED", FULFILLED: null, CANCELLED: null,
};
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "مسودة", CONFIRMED: "مؤكد", FULFILLED: "منفذ", CANCELLED: "ملغى",
};

function useSalesOrders() {
  return useQuery({ queryKey: ["sales-orders"], queryFn: () => fetch("/api/sales-orders").then((r) => r.json()) });
}
function useCustomers() {
  return useQuery({ queryKey: ["customers"], queryFn: () => fetch("/api/customers").then((r) => r.json()) });
}
function useItemsList() {
  return useQuery({ queryKey: ["items", ""], queryFn: () => fetch("/api/items?pageSize=200").then((r) => r.json()) });
}

function NewCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      .then(async (r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["customers"] }); toast.success("تمت إضافة العميل"); setOpen(false); setForm({ name: "", email: "", phone: "", address: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> عميل جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة عميل</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>الاسم</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>العنوان</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={isPending || !form.name} onClick={() => mutate()}>{isPending ? "جارٍ الحفظ..." : "حفظ العميل"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewSalesOrderDialog() {
  const [open, setOpen] = useState(false);
  const { data: custData } = useCustomers();
  const { data: itemsData } = useItemsList();
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ itemId: "", quantity: 1, unitPrice: 0 }]);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/sales-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, lines: lines.filter((l) => l.itemId) }),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success("تم إنشاء طلب البيع"); setOpen(false); setLines([{ itemId: "", quantity: 1, unitPrice: 0 }]); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> طلب بيع جديد</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>إنشاء طلب بيع</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>العميل</Label>
            <NativeSelect className="w-full" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">اختر العميل...</option>
              {custData?.customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>
          <Label>بنود الطلب</Label>
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <NativeSelect className="flex-1" value={line.itemId} onChange={(e) => {
                const item = itemsData?.items.find((it: any) => it.id === e.target.value);
                setLines(lines.map((l, j) => j === i ? { ...l, itemId: e.target.value, unitPrice: item ? Number(item.salePrice) : 0 } : l));
              }}>
                <option value="">اختر الصنف...</option>
                {itemsData?.items.map((it: any) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}
              </NativeSelect>
              <Input type="number" min={1} className="w-20" value={line.quantity} onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, quantity: Number(e.target.value) } : l))} />
              <Input type="number" min={0} step="0.01" className="w-24" value={line.unitPrice} onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, unitPrice: Number(e.target.value) } : l))} />
              <Button variant="ghost" size="icon" onClick={() => setLines(lines.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { itemId: "", quantity: 1, unitPrice: 0 }])}><Plus className="h-3 w-3" /> إضافة بند</Button>
        </div>
        <DialogFooter><Button disabled={isPending || !customerId} onClick={() => mutate()}>{isPending ? "جارٍ الحفظ..." : "إنشاء الطلب"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OrdersTab() {
  const { data, isLoading } = useSalesOrders();
  const qc = useQueryClient();
  const { mutate: advance } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/sales-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success("تم تحديث الحالة"); },
  });
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/sales-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success("تم حذف الطلب"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewSalesOrderDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>رقم الطلب</TableHead><TableHead>العميل</TableHead><TableHead>التاريخ</TableHead>
            <TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead className="w-32" />
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
            {!isLoading && data?.salesOrders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-6 w-6" /> لا توجد طلبات بيع بعد.</TableCell></TableRow>
            )}
            {data?.salesOrders.map((so: any) => {
              const total = so.lines.reduce((s: number, l: any) => s + l.quantity * Number(l.unitPrice), 0);
              const next = STATUS_FLOW[so.status];
              return (
                <TableRow key={so.id}>
                  <TableCell className="font-mono text-xs">{so.orderNumber}</TableCell>
                  <TableCell>{so.customer.name}</TableCell>
                  <TableCell>{formatDate(so.orderDate)}</TableCell>
                  <TableCell>{formatCurrency(total)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[so.status]}>{STATUS_LABELS[so.status]}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {next && <Button size="sm" variant="outline" onClick={() => advance({ id: so.id, status: next })}>نقل إلى {STATUS_LABELS[next]}</Button>}
                    <Button variant="ghost" size="icon" onClick={() => remove(so.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
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

function CustomersTab() {
  const { data, isLoading } = useCustomers();
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewCustomerDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>البريد الإلكتروني</TableHead><TableHead>الهاتف</TableHead><TableHead>العنوان</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 4 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
            {data?.customers.map((c: any) => (
              <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.email || "—"}</TableCell><TableCell>{c.phone || "—"}</TableCell><TableCell>{c.address || "—"}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">المبيعات</h1>
        <p className="text-sm text-muted-foreground">إدارة العملاء وطلبات البيع.</p>
      </div>
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="customers">العملاء</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="customers"><CustomersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

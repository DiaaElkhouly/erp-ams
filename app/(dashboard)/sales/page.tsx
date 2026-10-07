"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { TablePagination } from "@/components/shared/data-table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { PartyTable } from "@/features/parties/components/party-table";
import { usePartiesList } from "@/features/parties/hooks/use-parties";
import { useItemsForPickers } from "@/features/bom/hooks/use-boms";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/page-header";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "success" | "destructive"> = {
  DRAFT: "secondary", CONFIRMED: "default", FULFILLED: "success", CANCELLED: "destructive",
};
const STATUS_FLOW: Record<string, string | null> = {
  DRAFT: "CONFIRMED", CONFIRMED: "FULFILLED", FULFILLED: null, CANCELLED: null,
};

function useSalesOrders() {
  return useQuery({ queryKey: ["sales-orders"], queryFn: () => fetch("/api/sales-orders").then((r) => r.json()) });
}

function NewSalesOrderDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: custData } = usePartiesList("customers");
  const { data: itemsData } = useItemsForPickers();
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState([{ itemId: "", quantity: 1, unitPrice: 0 }]);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/sales-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, lines: lines.filter((l) => l.itemId) }),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success(t.orders.created); setOpen(false); setCustomerId(""); setLines([{ itemId: "", quantity: 1, unitPrice: 0 }]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filledLines = lines.filter((l) => l.itemId);
  const orderTotal = filledLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> {t.orders.newSales}</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.orders.createSales}</DialogTitle>
          <DialogDescription>{t.orders.description.replace("{party}", t.common.customer)}</DialogDescription>
        </DialogHeader>

        {/* Long orders scroll inside the dialog instead of stretching it past the viewport. */}
        <div className="-mx-1 max-h-[55vh] space-y-5 overflow-y-auto px-1">
          <div className="grid gap-1.5">
            <Label htmlFor="sales-order-customer">{t.common.customer}</Label>
            <NativeSelect
              id="sales-order-customer"
              className="w-full"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{t.orders.selectCustomer}</option>
              {custData?.customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.orders.lines}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLines([...lines, { itemId: "", quantity: 1, unitPrice: 0 }])}
              >
                <Plus className="h-3.5 w-3.5" /> {t.orders.addLine}
              </Button>
            </div>

            {/* The select column is minmax(0,1fr) and the select itself carries min-w-0:
                a native <select> is sized by its widest <option>, so without both it
                refuses to shrink and spills outside the dialog. */}
            <div className="hidden grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] items-center gap-2 px-0.5 text-xs font-medium text-muted-foreground sm:grid">
              <span>{t.common.item}</span>
              <span className="text-center">{t.common.quantity}</span>
              <span className="text-center">{t.common.salePrice}</span>
              <span />
            </div>

            <div className="space-y-2">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 items-center gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[minmax(0,1fr)_5rem_7rem_2.25rem] sm:border-0 sm:p-0"
                >
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">{t.common.item}</span>
                    <NativeSelect
                      className="w-full min-w-0"
                      aria-label={t.orders.lineItem(i + 1)}
                      value={line.itemId}
                      onChange={(e) => {
                        const item = itemsData?.items.find((it: any) => it.id === e.target.value);
                        setLines(lines.map((l, j) => j === i ? { ...l, itemId: e.target.value, unitPrice: item ? Number(item.salePrice) : 0 } : l));
                      }}
                    >
                      <option value="">{t.common.selectItem}</option>
                      {itemsData?.items.map((it: any) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">{t.common.quantity}</span>
                    <Input
                      type="number"
                      min={1}
                      aria-label={t.orders.lineQuantity(i + 1)}
                      className="w-full text-center"
                      value={line.quantity}
                      onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, quantity: Number(e.target.value) } : l))}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:contents">
                    <span className="text-xs font-medium text-muted-foreground sm:hidden">{t.common.salePrice}</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      aria-label={t.orders.lineUnitPrice(i + 1)}
                      className="w-full text-center"
                      value={line.unitPrice}
                      onChange={(e) => setLines(lines.map((l, j) => j === i ? { ...l, unitPrice: Number(e.target.value) } : l))}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="justify-self-end text-muted-foreground hover:text-destructive sm:justify-self-center"
                    disabled={lines.length === 1}
                    aria-label={t.orders.removeLine(i + 1)}
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
              <span className="text-sm text-muted-foreground">{t.orders.filledLines}</span>
              <span className="text-sm font-medium tabular-nums">{t.orders.completedOf(filledLines.length, lines.length)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
              <span className="text-sm text-muted-foreground">{t.orders.orderTotal}</span>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(orderTotal)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isPending || !customerId || filledLines.length === 0}
            onClick={() => mutate()}
          >
            {isPending ? t.common.saving : t.orders.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function OrdersTab() {
  const { t } = useI18n();
  const { data, isLoading } = useSalesOrders();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const qc = useQueryClient();
  const { mutate: advance } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/sales-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success(t.common.statusUpdated); },
  });
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/sales-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sales-orders"] }); toast.success(t.orders.deleted); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><NewSalesOrderDialog /></div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t.common.orderNumber}</TableHead><TableHead>{t.common.customer}</TableHead><TableHead>{t.common.date}</TableHead>
            <TableHead>{t.common.total}</TableHead><TableHead>{t.common.status}</TableHead><TableHead className="w-32" />
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)}
            {!isLoading && data?.salesOrders.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground"><ShoppingCart className="mx-auto mb-2 h-6 w-6" /> {t.orders.salesEmpty}</TableCell></TableRow>
            )}
            {(data?.salesOrders ?? []).slice((page - 1) * pageSize, page * pageSize).map((so: any) => {
              const total = so.lines.reduce((s: number, l: any) => s + l.quantity * Number(l.unitPrice), 0);
              const next = STATUS_FLOW[so.status];
              return (
                <TableRow key={so.id}>
                  <TableCell className="font-mono text-xs">{so.orderNumber}</TableCell>
                  <TableCell>{so.customer.name}</TableCell>
                  <TableCell>{formatDate(so.orderDate)}</TableCell>
                  <TableCell>{formatCurrency(total)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[so.status]}>{t.status[so.status as keyof typeof t.status]}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    {next && <Button size="sm" variant="outline" onClick={() => advance({ id: so.id, status: next })}>{t.production.moveTo(t.status[next as keyof typeof t.status])}</Button>}
                    <Button variant="ghost" size="icon" onClick={() => remove(so.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageCount={Math.max(1, Math.ceil((data?.salesOrders?.length ?? 0) / pageSize))}
        pageSize={pageSize}
        total={data?.salesOrders?.length ?? 0}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
      />
    </div>
  );
}

export default function SalesPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader title={t.nav.sales} description={t.pages.salesDescription} />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">{t.nav.orders}</TabsTrigger>
          <TabsTrigger value="customers">{t.common.customers}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
        <TabsContent value="customers"><PartyTable kind="customers" /></TabsContent>
      </Tabs>
    </div>
  );
}

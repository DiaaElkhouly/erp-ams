"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Factory, FlaskConical } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "warning" | "success" | "destructive"> = {
  PLANNED: "secondary", RELEASED: "default", IN_PROGRESS: "warning", COMPLETED: "success", CANCELLED: "destructive",
};
const STATUS_FLOW: Record<string, string | null> = {
  PLANNED: "RELEASED", RELEASED: "IN_PROGRESS", IN_PROGRESS: "COMPLETED", COMPLETED: null, CANCELLED: null,
};

function useWorkOrders() {
  return useQuery({ queryKey: ["work-orders"], queryFn: () => fetch("/api/work-orders").then((r) => r.json()) });
}
function useBomsList() {
  return useQuery({ queryKey: ["boms"], queryFn: () => fetch("/api/boms").then((r) => r.json()) });
}
function useWarehousesList() {
  return useQuery({ queryKey: ["warehouses"], queryFn: () => fetch("/api/warehouses").then((r) => r.json()) });
}

function NewWorkOrderDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { data: bomData } = useBomsList();
  const { data: whData } = useWarehousesList();
  const [form, setForm] = useState({ bomId: "", warehouseId: "", quantity: 1, dueDate: "" });
  const qc = useQueryClient();

  // The finished good is derived from the BOM server-side. Never send itemId from
  // here: the BOM's first component is a raw material, not the good being made.
  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/work-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success(t.production.created);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> {t.common.newWorkOrder}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.production.createTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t.production.bom}</Label>
            <NativeSelect className="w-full" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })}>
              <option value="">{t.production.selectBom}</option>
              {bomData?.boms.map((b: any) => <option key={b.id} value={b.id}>{b.name} (v{b.version}) &rarr; {b.finishedItem?.sku}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>{t.production.targetWarehouse}</Label>
            <NativeSelect className="w-full" value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>
              <option value="">{t.production.selectWarehouse}</option>
              {whData?.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>{t.production.quantity}</Label>
            <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.production.dueDate}</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !form.bomId || !form.warehouseId} onClick={() => mutate()}>
            {isPending ? t.production.creating : t.production.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductionPage() {
  const { t } = useI18n();
  const { data, isLoading } = useWorkOrders();
  const qc = useQueryClient();
  const { mutate: advance } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/work-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); toast.success(t.common.statusUpdated); },
  });
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/work-orders/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["work-orders"] }); toast.success(t.production.deleted); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.production}</h1>
          <p className="text-sm text-muted-foreground">{t.pages.productionDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/lab"><Button size="sm" variant="outline"><FlaskConical className="h-4 w-4" />{t.production.mixDesign}</Button></Link>
          <NewWorkOrderDialog />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.common.orderNumber}</TableHead>
              <TableHead>{t.nav.bom}</TableHead>
              <TableHead>{t.common.warehouse}</TableHead>
              <TableHead>{t.common.quantity}</TableHead>
              <TableHead>{t.production.due}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            ))}
            {!isLoading && data?.workOrders.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                <Factory className="mx-auto mb-2 h-6 w-6" /> {t.production.empty}
              </TableCell></TableRow>
            )}
            {data?.workOrders.map((wo: any) => {
              const next = STATUS_FLOW[wo.status];
              return (
                <TableRow key={wo.id}>
                  <TableCell className="font-mono text-xs">{wo.orderNumber}</TableCell>
                  <TableCell>{wo.bom.name}</TableCell>
                  <TableCell>{wo.warehouse.name}</TableCell>
                  <TableCell>{wo.quantity}</TableCell>
                  <TableCell>{wo.dueDate ? formatDate(wo.dueDate) : "—"}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[wo.status]}>{t.status[wo.status as keyof typeof t.status]}</Badge></TableCell>
                  <TableCell className="flex items-center gap-1">
                    {next && (
                      <Button size="sm" variant="outline" onClick={() => advance({ id: wo.id, status: next })}>
                        {t.production.moveTo(t.status[next as keyof typeof t.status])}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(wo.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
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

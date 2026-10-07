"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { PageHeader } from "@/components/shared/page-header";

interface Warehouse {
  id: string;
  code: string;
  name: string;
  location?: string | null;
  isActive: boolean;
  stockLevels: { quantity: number; item: { name: string; unit: string } }[];
}

function useWarehouses() {
  return useQuery<{ warehouses: Warehouse[] }>({
    queryKey: ["warehouses"],
    queryFn: () => fetch("/api/warehouses").then((r) => r.json()),
  });
}

function NewWarehouseDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", location: "" });
  const qc = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/warehouses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    }).then((r) => { if (!r.ok) throw new Error("Failed to create warehouse"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(t.warehouse.created);
      setOpen(false);
      setForm({ code: "", name: "", location: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> {t.common.newWarehouse}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.warehouse.addTitle}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t.common.code}</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="WH-01" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.name}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Main Distribution Center" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.location}</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Cebu City, PH" />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !form.code || !form.name} onClick={() => mutate()}>
            {isPending ? t.common.saving : t.warehouse.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function WarehousePage() {
  const { t } = useI18n();
  const { data, isLoading } = useWarehouses();
  const qc = useQueryClient();
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/warehouses/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["warehouses"] }); toast.success(t.warehouse.deleted); },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.nav.warehouse}
        description={t.pages.warehouseDescription}
        actions={<NewWarehouseDialog />}
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      )}

      {!isLoading && data?.warehouses.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <WarehouseIcon className="h-6 w-6" /> {t.warehouse.empty}
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.warehouses.map((wh) => {
          const totalUnits = wh.stockLevels.reduce((s, l) => s + l.quantity, 0);
          return (
            <Card key={wh.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle>{wh.name}</CardTitle>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{wh.code}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(wh.id)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">{wh.location ?? t.warehouse.noLocation}</p>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{wh.stockLevels.length} SKUs</Badge>
                  <span className="text-sm font-medium">{totalUnits} units</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

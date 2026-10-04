"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, ListTree, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/select-native";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";

function useBoms() {
  return useQuery({ queryKey: ["boms"], queryFn: () => fetch("/api/boms").then((r) => r.json()) });
}
function useItemsList() {
  return useQuery({ queryKey: ["items", ""], queryFn: () => fetch("/api/items?pageSize=200").then((r) => r.json()) });
}

function NewBomDialog() {
  const [open, setOpen] = useState(false);
  const { data: itemsData } = useItemsList();
  const [name, setName] = useState("");
  const [finishedItemId, setFinishedItemId] = useState("");
  const [version, setVersion] = useState("1.0");
  const [rows, setRows] = useState<{ itemId: string; quantity: number }[]>([{ itemId: "", quantity: 1 }]);
  const qc = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => fetch("/api/boms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, finishedItemId, version, components: rows.filter((r) => r.itemId) }),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boms"] });
      toast.success("تم إنشاء قائمة المواد");
      setOpen(false);
      setName(""); setFinishedItemId(""); setRows([{ itemId: "", quantity: 1 }]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4" /> قائمة مواد جديدة</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>إنشاء قائمة مواد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>اسم قائمة المواد</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bracket Assembly" />
            </div>
            <div className="space-y-1.5">
              <Label>رمز المنتج النهائي</Label>
              <NativeSelect
                className="w-full"
                value={finishedItemId}
                onChange={(e) => setFinishedItemId(e.target.value)}
              >
                <option value="">اختر صنفًا...</option>
                {itemsData?.items
                  .filter((it: any) => it.type === "FINISHED_GOOD")
                  .map((it: any) => <option key={it.id} value={it.id}>{it.sku} - {it.name}</option>)}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>الإصدار</Label>
            <Input value={version} onChange={(e) => setVersion(e.target.value)} className="w-24" />
          </div>

          <div className="space-y-2">
            <Label>المكونات</Label>
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <NativeSelect
                  className="flex-1"
                  value={row.itemId}
                  onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, itemId: e.target.value } : r))}
                >
                  <option value="">اختر صنفًا...</option>
                  {itemsData?.items.map((it: any) => <option key={it.id} value={it.id}>{it.sku} — {it.name}</option>)}
                </NativeSelect>
                <Input
                  type="number" min={0.001} step="0.001" className="w-24"
                  value={row.quantity}
                  onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, quantity: Number(e.target.value) } : r))}
                />
                <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { itemId: "", quantity: 1 }])}>
              <Plus className="h-3 w-3" /> إضافة مكوّن
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending || !name || !finishedItemId} onClick={() => mutate()}>
            {isPending ? "جارٍ الحفظ..." : "حفظ قائمة المواد"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BomPage() {
  const { data, isLoading } = useBoms();
  const qc = useQueryClient();
  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => fetch(`/api/boms/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boms"] }); toast.success("تم حذف قائمة المواد"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">قائمة المواد</h1>
          <p className="text-sm text-muted-foreground">تعريف المكونات المطلوبة لإنتاج كل منتج نهائي.</p>
        </div>
        <NewBomDialog />
      </div>

      {isLoading && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>}

      {!isLoading && data?.boms.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ListTree className="h-6 w-6" /> لا توجد قوائم مواد بعد.
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data?.boms.map((bom: any) => (
          <Card key={bom.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{bom.name}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{bom.finishedItem?.sku} &middot; v{bom.version}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(bom.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {bom.components.map((c: any) => (
                  <li key={c.id} className="flex justify-between border-b py-1 last:border-0">
                    <span>{c.item.name}</span>
                    <span className="text-muted-foreground">{c.quantity} {c.item.unit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

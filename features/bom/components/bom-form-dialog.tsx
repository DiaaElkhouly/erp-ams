"use client";

import { useEffect, useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select-native";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateBom, useItemsForPickers, useUpdateBom } from "../hooks/use-boms";
import type { Bom, BomComponentInput } from "../services/bom-service";
import { useI18n } from "@/lib/i18n";

type Row = BomComponentInput;

const emptyRow: Row = { itemId: "", quantity: 1 };

/**
 * Create or edit a bill of materials.
 *
 * One dialog for both: the fields are identical, and splitting them would leave
 * two places where "a BOM must have at least one component" is enforced.
 *
 * `locked` is set for a BOM that already has work orders. The server refuses to
 * change its composition (see app/api/boms/[id]) because completion consumes
 * whatever components exist at the time, so the fields are disabled here rather
 * than letting the user fill in a form that will 409.
 */
export function BomFormDialog({
  bom,
  open,
  onOpenChange,
}: {
  bom: Bom | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { data: itemsData } = useItemsForPickers();
  const create = useCreateBom();
  const update = useUpdateBom();

  const [name, setName] = useState("");
  const [finishedItemId, setFinishedItemId] = useState("");
  const [version, setVersion] = useState("1.0");
  const [rows, setRows] = useState<Row[]>([emptyRow]);

  useEffect(() => {
    if (!open) return;
    setName(bom?.name ?? "");
    setFinishedItemId(bom?.finishedItemId ?? "");
    setVersion(bom?.version ?? "1.0");
    setRows(
      bom?.components.length
        ? bom.components.map((component) => ({ itemId: component.itemId, quantity: Number(component.quantity) }))
        : [emptyRow],
    );
  }, [open, bom]);

  const items = itemsData?.items ?? [];
  const finishedGoods = items.filter((item) => item.type === "FINISHED_GOOD");
  const filled = rows.filter((row) => row.itemId);
  const isPending = create.isPending || update.isPending;

  // Work-order completion consumes whatever BomComponent rows exist at completion
  // time, so the server (app/api/boms/[id]) refuses to rewrite a BOM that has one.
  // Disable the fields here instead of offering a form that would 409.
  const compositionLocked = Boolean(bom && bom._count && bom._count.workOrders > 0);

  function submit() {
    // Only send the composition on a BOM that is allowed to have it changed, so an
    // edit of just the version cannot trip the same guard.
    const payload = bom && compositionLocked
      ? { name: name.trim(), version: version.trim() || "1.0" }
      : { name: name.trim(), finishedItemId, version: version.trim() || "1.0", components: filled };
    const done = () => onOpenChange(false);
    if (bom) update.mutate({ id: bom.id, patch: payload }, { onSuccess: done });
    else create.mutate(payload as Parameters<typeof create.mutate>[0], { onSuccess: done });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{bom ? t.common.editBom : t.common.createBom}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bom-name">{t.common.bomName}</Label>
              <Input id="bom-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bracket Assembly" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bom-finished-item">{t.common.finishedGoodSku}</Label>
              <NativeSelect
                id="bom-finished-item"
                className="w-full"
                disabled={compositionLocked}
                value={finishedItemId}
                onChange={(e) => setFinishedItemId(e.target.value)}
              >
                <option value="">{t.common.selectFinishedGood}</option>
                {finishedGoods.map((item) => <option key={item.id} value={item.id}>{item.sku} - {item.name}</option>)}
              </NativeSelect>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bom-version">{t.common.version}</Label>
            <Input id="bom-version" value={version} onChange={(e) => setVersion(e.target.value)} className="w-24" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{t.common.components}</Label>
              {!compositionLocked && (
                <Button variant="outline" size="sm" onClick={() => setRows([...rows, emptyRow])}>
                  <Plus className="h-3 w-3" /> {t.common.addComponent}
                </Button>
              )}
            </div>
            {compositionLocked && (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{t.bom.compositionLocked}</p>
            )}
            {rows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <NativeSelect
                  aria-label={t.common.componentItem}
                  className="flex-1"
                  disabled={compositionLocked}
                  value={row.itemId}
                  onChange={(e) => setRows(rows.map((r, j) => (j === index ? { ...r, itemId: e.target.value } : r)))}
                >
                  <option value="">{t.common.selectItem}</option>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}
                </NativeSelect>
                <Input
                  aria-label={t.common.componentQuantity}
                  type="number" min={0.001} step="0.001" className="w-24"
                  disabled={compositionLocked}
                  value={row.quantity}
                  onChange={(e) => setRows(rows.map((r, j) => (j === index ? { ...r, quantity: Number(e.target.value) } : r)))}
                />
                {!compositionLocked && (
                  <Button
                    variant="ghost" size="icon" aria-label={t.common.removeComponent}
                    onClick={() => setRows(rows.length === 1 ? [emptyRow] : rows.filter((_, j) => j !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
          <Button
            disabled={isPending || !name.trim() || (!compositionLocked && (!finishedItemId || filled.length === 0))}
            onClick={submit}
          >
            <Save className="h-4 w-4" />
            {isPending ? t.common.saving : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
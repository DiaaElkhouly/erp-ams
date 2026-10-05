"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/select-native";
import { FileUpload } from "@/components/shared/file-upload";
import { useUpdateItem } from "../hooks/use-items";
import type { Item, ItemPatch } from "../services/item-service";
import { useI18n } from "@/lib/i18n";

const schema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"]),
  unit: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative(),
  reorderQty: z.coerce.number().int().nonnegative(),
  preferredSupplierId: z.string(),
  isActive: z.boolean(),
  photoKey: z.string(),
});
type FormValues = z.infer<typeof schema>;

/**
 * Replaces one item.
 *
 * `preferredSupplierId` is a foreign key with no database-level "must exist" rule
 * beyond referential integrity, so it round-trips as a string and the empty string
 * becomes an explicit null on submit — "take this item off every supplier's
 * catalogue" is a real edit, and sending "" would be a 500 rather than the intent.
 */
export function ItemEditDialog({
  item,
  onOpenChange,
}: {
  item: Item | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const { mutate, isPending } = useUpdateItem();

  const { data: supplierData } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => fetch("/api/suppliers").then((response) => response.json() as Promise<{ suppliers: { id: string; name: string }[] }>),
    enabled: item !== null,
  });

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Re-seed on every open. Without this the dialog shows the last item's values
  // after an edit, because react-hook-form state survives the unmount.
  useEffect(() => {
    if (!item) return;
    reset({
      sku: item.sku,
      name: item.name,
      description: item.description ?? "",
      type: item.type,
      unit: item.unit,
      costPrice: Number(item.costPrice),
      salePrice: Number(item.salePrice),
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      preferredSupplierId: item.preferredSupplierId ?? "",
      isActive: item.isActive,
      photoKey: item.photoKey ?? "",
    });
  }, [item, reset]);

  function onSubmit(values: FormValues) {
    if (!item) return;
    const patch: ItemPatch = {
      sku: values.sku,
      name: values.name,
      description: values.description || null,
      type: values.type,
      unit: values.unit,
      costPrice: values.costPrice,
      salePrice: values.salePrice,
      reorderPoint: values.reorderPoint,
      reorderQty: values.reorderQty,
      preferredSupplierId: values.preferredSupplierId || null,
      isActive: values.isActive,
      photoKey: values.photoKey || null,
    };
    mutate(
      { id: item.id, patch },
      {
        onSuccess: () => onOpenChange(false),
        // The row the user clicked is stale while the dialog is closing, so hold
        // it open on failure rather than closing on an error.
      },
    );
  }

  const photoKey = watch("photoKey");

  if (!item) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.common.editItem}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-sku">{t.common.sku}</Label>
            <Input id="edit-sku" {...register("sku")} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-type">{t.common.type}</Label>
            <NativeSelect id="edit-type" {...register("type")} className="w-full">
              <option value="RAW_MATERIAL">{t.common.rawMaterial}</option>
              <option value="COMPONENT">{t.common.component}</option>
              <option value="FINISHED_GOOD">{t.common.finishedGood}</option>
              <option value="CONSUMABLE">{t.common.consumable}</option>
            </NativeSelect>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="edit-name">{t.common.name}</Label>
            <Input id="edit-name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="edit-description">{t.common.description}</Label>
            <Input id="edit-description" {...register("description")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-unit">{t.common.unit}</Label>
            <Input id="edit-unit" {...register("unit")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-reorder-point">{t.common.reorderPoint}</Label>
            <Input id="edit-reorder-point" type="number" {...register("reorderPoint")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-cost">{t.common.costPrice}</Label>
            <Input id="edit-cost" type="number" step="0.01" {...register("costPrice")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-price">{t.common.salePrice}</Label>
            <Input id="edit-price" type="number" step="0.01" {...register("salePrice")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-reorder-qty">{t.common.reorderQuantity}</Label>
            <Input id="edit-reorder-qty" type="number" {...register("reorderQty")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-supplier">{t.common.preferredSupplier}</Label>
            <NativeSelect id="edit-supplier" {...register("preferredSupplierId")} className="w-full">
              <option value="">{t.common.noPreferredSupplier}</option>
              {supplierData?.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </NativeSelect>
          </div>

          <div className="col-span-2">
            <FileUpload
              kind="item-photo"
              accept="image/png,image/jpeg,image/webp,image/avif"
              label={t.common.itemPhoto}
              hint={t.common.itemPhotoHint}
              value={photoKey || null}
              onUploaded={(key) => setValue("photoKey", key, { shouldDirty: true })}
              onCleared={() => setValue("photoKey", "", { shouldDirty: true })}
            />
          </div>

          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...register("isActive")} />
            {t.common.itemActive}
          </label>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t.common.cancel}</Button>
            <Button type="submit" disabled={isPending}>{isPending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
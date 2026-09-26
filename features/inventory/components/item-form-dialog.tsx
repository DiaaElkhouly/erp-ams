"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/select-native";
import { useCreateItem } from "../hooks/use-items";
import { useI18n } from "@/lib/i18n";

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  type: z.enum(["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"]),
  unit: z.string().min(1),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  reorderPoint: z.coerce.number().int().nonnegative(),
  reorderQty: z.coerce.number().int().nonnegative(),
});
type FormValues = z.infer<typeof schema>;

export function ItemFormDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateItem();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "RAW_MATERIAL", unit: "pcs", costPrice: 0, salePrice: 0, reorderPoint: 0, reorderQty: 0 },
  });

  function onSubmit(values: FormValues) {
    mutate(values, { onSuccess: () => { setOpen(false); reset(); } });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4" /> {t.common.newItem}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.common.newItem}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="col-span-1 space-y-1.5">
            <Label>SKU</Label>
            <Input {...register("sku")} placeholder="RM-1001" />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>
          <div className="col-span-1 space-y-1.5">
            <Label>{t.common.type}</Label>
            <NativeSelect {...register("type")} className="w-full">
              <option value="RAW_MATERIAL">{t.common.rawMaterial}</option>
              <option value="COMPONENT">{t.common.component}</option>
              <option value="FINISHED_GOOD">{t.common.finishedGood}</option>
              <option value="CONSUMABLE">{t.common.consumable}</option>
            </NativeSelect>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t.common.name}</Label>
            <Input {...register("name")} placeholder="Steel Sheet 2mm" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.unit}</Label>
            <Input {...register("unit")} placeholder="pcs / kg / m" />
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.costPrice}</Label>
            <Input type="number" step="0.01" {...register("costPrice")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.salePrice}</Label>
            <Input type="number" step="0.01" {...register("salePrice")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.common.reorderPoint}</Label>
            <Input type="number" {...register("reorderPoint")} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t.common.reorderQuantity}</Label>
            <Input type="number" {...register("reorderQty")} />
          </div>
          <DialogFooter className="col-span-2 mt-2">
            <Button type="submit" disabled={isPending}>{isPending ? t.common.saving : t.common.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

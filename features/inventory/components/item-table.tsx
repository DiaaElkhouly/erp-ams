"use client";

import { useState } from "react";
import { Search, Trash2, PackageX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useItems, useDeleteItem } from "../hooks/use-items";
import { formatCurrency } from "@/lib/utils";
import { ItemFormDialog } from "./item-form-dialog";
import { useI18n } from "@/lib/i18n";

const TYPE_VARIANT: Record<string, "default" | "secondary" | "success" | "warning"> = {
  RAW_MATERIAL: "secondary",
  COMPONENT: "default",
  FINISHED_GOOD: "success",
  CONSUMABLE: "warning",
};

export function ItemTable() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const { data, isLoading } = useItems(query);
  const { mutate: deleteItem } = useDeleteItem();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t.common.search} className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <ItemFormDialog />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>{t.common.name}</TableHead>
              <TableHead>{t.common.type}</TableHead>
              <TableHead>{t.common.onHand}</TableHead>
              <TableHead>{t.common.reorderPt}</TableHead>
              <TableHead>{t.common.cost}</TableHead>
              <TableHead>{t.common.price}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  <PackageX className="mx-auto mb-2 h-6 w-6" />
                  {t.common.noItems}
                </TableCell>
              </TableRow>
            )}

            {data?.items.map((item) => {
              const onHand = item.stockLevels.reduce((s, l) => s + l.quantity, 0);
              const low = onHand <= item.reorderPoint;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell><Badge variant={TYPE_VARIANT[item.type]}>{t.common[item.type === "RAW_MATERIAL" ? "rawMaterial" : item.type === "FINISHED_GOOD" ? "finishedGood" : item.type === "COMPONENT" ? "component" : "consumable"]}</Badge></TableCell>
                  <TableCell className={low ? "font-semibold text-destructive" : ""}>{onHand} {item.unit}</TableCell>
                  <TableCell className="text-muted-foreground">{item.reorderPoint}</TableCell>
                  <TableCell>{formatCurrency(item.costPrice)}</TableCell>
                  <TableCell>{formatCurrency(item.salePrice)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
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

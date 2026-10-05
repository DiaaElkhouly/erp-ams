"use client";

import { useState } from "react";
import { ListTree, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BomFormDialog } from "@/features/bom/components/bom-form-dialog";
import { useBoms, useDeleteBom } from "@/features/bom/hooks/use-boms";
import type { Bom } from "@/features/bom/services/bom-service";
import { useI18n } from "@/lib/i18n";

export default function BomPage() {
  const { t } = useI18n();
  const { data, isLoading } = useBoms();
  const { mutate: remove } = useDeleteBom();
  const [editing, setEditing] = useState<Bom | null>(null);
  const [creating, setCreating] = useState(false);

  const boms = data?.boms ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.bom}</h1>
          <p className="text-sm text-muted-foreground">{t.pages.bomDescription}</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> {t.common.newBom}
        </Button>
      </div>

      {isLoading && <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}</div>}

      {!isLoading && boms.length === 0 && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <ListTree className="h-6 w-6" /> {t.common.noBoms}
        </CardContent></Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {boms.map((bom) => (
          <Card key={bom.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{bom.name}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {bom.finishedItem?.sku} &middot; v{bom.version}
                  {!bom.isActive && <Badge variant="secondary" className="ms-2">{t.common.inactive}</Badge>}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEditing(bom)} aria-label={t.common.edit}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(bom.id)} aria-label={t.common.delete}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {bom.components.map((component) => (
                  <li key={component.id} className="flex justify-between border-b py-1 last:border-0">
                    <span>{component.item?.name}</span>
                    <span className="text-muted-foreground">{Number(component.quantity)} {component.item?.unit}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <BomFormDialog bom={editing} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} />
      <BomFormDialog bom={null} open={creating} onOpenChange={setCreating} />
    </div>
  );
}
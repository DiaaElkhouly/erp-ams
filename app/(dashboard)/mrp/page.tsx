"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlayCircle, CalendarClock, ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { OfflineBanner } from "@/components/shared/offline-banner";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

function useMrpRuns() {
  return useQuery({ queryKey: ["mrp-runs"], queryFn: () => fetch("/api/mrp").then((r) => r.json()) });
}

export default function MrpPage() {
  const { t } = useI18n();
  const { data, isLoading } = useMrpRuns();
  const qc = useQueryClient();
  const { mutate: run, isPending } = useMutation({
    mutationFn: () => fetch("/api/mrp", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `MRP Run ${new Date().toLocaleString()}` }),
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? "Failed"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mrp-runs"] }); toast.success(t.mrp.runComplete); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: generate, isPending: generating } = useMutation({
    mutationFn: () => fetch(`/api/mrp/${latestId}/purchase-orders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).then(async (r) => {
      const payload = await r.json();
      if (!r.ok) throw new Error(payload.error ?? "Failed");
      return payload;
    }),
    onSuccess: (payload) => {
      qc.invalidateQueries({ queryKey: ["mrp-runs"] });
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      // Skipped lines are the actionable part: nobody can order an item that has
      // no supplier, so say which ones and why instead of reporting a clean run.
      if (payload.skipped?.length) {
        toast.warning(t.mrp.generatedWithSkips(payload.purchaseOrders.length, payload.skipped.length), {
          description: payload.skipped.map((s: any) => `${s.itemId}: ${s.reason}`).join(" · "),
        });
      } else {
        toast.success(t.mrp.generatedDrafts(payload.purchaseOrders.length));
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = data?.runs?.[0];
  const latestId = latest?.id;
  /** A line already turned into a PO is marked in the table and not re-offered. */
  const ungenerated = (latest?.lines ?? []).filter((line: any) => !line.purchaseOrderId);

  return (
    <div className="space-y-6">
      <OfflineBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.mrp}</h1>
          <p className="text-sm text-muted-foreground">{t.mrp.description}</p>
        </div>
        <Button size="sm" onClick={() => run()} disabled={isPending}>
          <PlayCircle className="h-4 w-4" /> {isPending ? t.common.running : `${t.common.run} MRP`}
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && !latest && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <CalendarClock className="h-6 w-6" /> {t.mrp.empty}
        </CardContent></Card>
      )}

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>{latest.name}</CardTitle>
            <CardDescription>{t.mrp.runAt} {formatDate(latest.runAt)} &middot; {latest.lines.length} {t.mrp.suggestions}</CardDescription>
          </CardHeader>
          <CardContent>
            {latest.lines.length > 0 && ungenerated.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  {t.mrp.toPurchaseOrders(ungenerated.length)}
                </p>
                <Button size="sm" variant="outline" onClick={() => generate()} disabled={generating}>
                  <ShoppingCart className="h-4 w-4" /> {generating ? t.mrp.generating : t.mrp.generatePurchaseOrders}
                </Button>
              </div>
            )}

            {latest.lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t.mrp.nothingToReplenish}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.item}</TableHead>
                    <TableHead>{t.common.onHand}</TableHead>
                    <TableHead>{t.mrp.openDemand}</TableHead>
                    <TableHead>{t.mrp.suggestedQty}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latest.lines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">
                        {line.item.name} <span className="text-xs text-muted-foreground">({line.item.sku})</span>
                        {/* No supplier means the PO generator will skip this line. */}
                        <span className="block text-xs text-muted-foreground">
                          {line.supplier?.name ?? "no preferred supplier"}
                        </span>
                      </TableCell>
                      <TableCell>{line.onHandQty}</TableCell>
                      <TableCell>{line.demandQty}</TableCell>
                      <TableCell>
                        {line.purchaseOrderId ? (
                          /* Already ordered: showing the raw quantity again would
                             invite someone to generate it a second time. */
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Check className="h-3.5 w-3.5 text-green-600" /> {line.suggestedQty} ordered
                          </span>
                        ) : (
                          <Badge variant="warning">{line.suggestedQty}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

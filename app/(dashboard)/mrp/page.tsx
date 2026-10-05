"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlayCircle, CalendarClock } from "lucide-react";
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["mrp-runs"] }); toast.success("MRP run complete"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = data?.runs?.[0];

  return (
    <div className="space-y-6">
      <OfflineBanner />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t.nav.mrp}</h1>
          <p className="text-sm text-muted-foreground">{t.localeName === "العربية" ? "يقارن المخزون المتاح بالطلب المفتوح ويقترح الكميات المطلوبة." : "Compares on-hand stock against open demand and suggests replenishment."}</p>
        </div>
        <Button size="sm" onClick={() => run()} disabled={isPending}>
          <PlayCircle className="h-4 w-4" /> {isPending ? t.common.running : `${t.common.run} MRP`}
        </Button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && !latest && (
        <Card><CardContent className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
          <CalendarClock className="h-6 w-6" /> {t.localeName === "العربية" ? "لا توجد عمليات تخطيط بعد. اضغط تشغيل لإنشاء المقترحات." : "No MRP runs yet. Click \"Run MRP\" to generate suggestions."}
        </CardContent></Card>
      )}

      {latest && (
        <Card>
          <CardHeader>
            <CardTitle>{latest.name}</CardTitle>
            <CardDescription>{t.localeName === "العربية" ? "تاريخ التشغيل" : "Run at"} {formatDate(latest.runAt)} &middot; {latest.lines.length} {t.localeName === "العربية" ? "مقترحات إعادة طلب" : "suggested replenishments"}</CardDescription>
          </CardHeader>
          <CardContent>
            {latest.lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t.localeName === "العربية" ? "جميع الأصناف أعلى من نقطة إعادة الطلب. لا توجد كميات مطلوبة." : "All items are above their reorder point. Nothing to replenish."}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.common.item}</TableHead>
                    <TableHead>{t.common.onHand}</TableHead>
                    <TableHead>{t.localeName === "العربية" ? "الطلب المفتوح" : "Open demand"}</TableHead>
                    <TableHead>{t.localeName === "العربية" ? "الكمية المقترحة" : "Suggested qty"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latest.lines.map((line: any) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-medium">{line.item.name} <span className="text-xs text-muted-foreground">({line.item.sku})</span></TableCell>
                      <TableCell>{line.onHandQty}</TableCell>
                      <TableCell>{line.demandQty}</TableCell>
                      <TableCell><Badge variant="warning">{line.suggestedQty}</Badge></TableCell>
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

"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  DateRange, DateRangeParams, formatRangeLabel, isPresetValid,
  resolveDateRange, resolvePreset, toDateInput, toTimeInput,
} from "@/lib/date-range";

/** Keys into `t.dateRange.presets`, not labels: the strings live in the catalog. */
const PRESET_IDS = [
  "today", "yesterday", "7d", "30d", "90d",
  "mtd", "lastMonth", "6m", "12m", "ytd", "all",
] as const;

type PresetId = (typeof PRESET_IDS)[number];

function readParams(searchParams: URLSearchParams): DateRangeParams {
  return {
    preset: searchParams.get("preset") ?? undefined,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    fromTime: searchParams.get("fromTime"),
    toTime: searchParams.get("toTime"),
  };
}

export function DateRangeFilter({ fallbackFrom }: { fallbackFrom?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const params = useMemo(() => readParams(new URLSearchParams(searchParams.toString())), [searchParams]);
  const range: DateRange = useMemo(
    () => resolveDateRange(params, fallbackFrom ? new Date(fallbackFrom) : undefined),
    [params, fallbackFrom],
  );

  const activePreset = params.preset && isPresetValid(params.preset) ? params.preset : "30d";
  const [fromDate, setFromDate] = useState(() => toDateInput(range.from));
  const [toDate, setToDate] = useState(() => toDateInput(range.to));
  const [fromTime, setFromTime] = useState(() => toTimeInput(range.from));
  const [toTime, setToTime] = useState(() => toTimeInput(range.to));

  const apply = useCallback(
    (next: Record<string, string | null>) => {
      const merged = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (!value) merged.delete(key);
        else merged.set(key, value);
      }
      startTransition(() => {
        router.replace(merged.toString() ? `${pathname}?${merged}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const applyPreset = useCallback(
    (preset: string) => {
      const resolved = resolvePreset(preset);
      setFromDate(toDateInput(resolved.from));
      setToDate(toDateInput(resolved.to));
      setFromTime("00:00");
      setToTime("23:59");
      apply({ preset, from: toDateInput(resolved.from), to: toDateInput(resolved.to), fromTime: "00:00", toTime: "23:59" });
    },
    [apply],
  );

  const applyCustom = useCallback(() => {
    if (!fromDate || !toDate) return;
    apply({ preset: "custom", from: fromDate, to: toDate, fromTime, toTime });
  }, [apply, fromDate, toDate, fromTime, toTime]);

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {t.dateRange.label}
        </div>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium">
          {formatRangeLabel(range)}
        </span>
        <span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
          {t.dateRange.daysAndGranularity
            .replace("{days}", String(range.days))
            .replace(
              "{granularity}",
              t.dateRange.granularity[range.granularity as keyof typeof t.dateRange.granularity],
            )}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_IDS.map((preset) => (
          <Button
            key={preset}
            size="sm"
            variant={activePreset === preset ? "default" : "outline"}
            onClick={() => applyPreset(preset)}
            className={cn(activePreset === preset && "shadow-sm")}
          >
            {t.dateRange.presets[preset]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => applyPreset("30d")} title={t.dateRange.reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t.dateRange.reset}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3 border-t pt-4">
        <div className="space-y-1.5">
          <Label className="text-xs">{t.dateRange.fromDate}</Label>
          <Input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t.dateRange.fromTime}</Label>
          <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="w-32" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t.dateRange.toDate}</Label>
          <Input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t.dateRange.toTime}</Label>
          <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value)} className="w-32" />
        </div>
        <Button onClick={applyCustom} disabled={!fromDate || !toDate}>
          <Clock className="h-4 w-4" />
          {t.common.apply}
        </Button>
      </div>
    </div>
  );
}

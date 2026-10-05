"use client";

import {
  AlertTriangle, Boxes, Coins, Factory, FlaskConical, Minus, Percent,
  Receipt, ShoppingCart, TrendingDown, TrendingUp, Truck, Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatDelta } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

/**
 * Icons are resolved here rather than passed in: a server component cannot hand a
 * component function to a client component.
 */
const ICONS = {
  wallet: Wallet,
  receipt: Receipt,
  trendingUp: TrendingUp,
  percent: Percent,
  shoppingCart: ShoppingCart,
  coins: Coins,
  boxes: Boxes,
  alertTriangle: AlertTriangle,
  factory: Factory,
  lab: FlaskConical,
  truck: Truck,
} as const;

export type KpiIcon = keyof typeof ICONS;

export type KpiCardProps = {
  label: string;
  value: string;
  icon?: KpiIcon;
  /** Percentage change vs the previous window. Null hides the badge. */
  deltaPct?: number | null;
  /** Use "inverse" for costs, where a drop is good news. */
  tone?: "default" | "inverse";
  hint?: string;
  footer?: string;
};

export function KpiCard({
  label, value, icon, deltaPct, tone = "default", hint, footer,
}: KpiCardProps) {
  const { t } = useI18n();
  const Icon = icon ? ICONS[icon] : null;
  const hasDelta = deltaPct !== null && deltaPct !== undefined && Number.isFinite(deltaPct);
  const rising = hasDelta && (deltaPct as number) > 0;
  const flat = hasDelta && Math.abs(deltaPct as number) < 0.05;
  const good = tone === "inverse" ? !rising : rising;

  const DeltaIcon = flat ? Minus : rising ? TrendingUp : TrendingDown;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      </CardHeader>
      <CardContent>
        <div className="tabular-nums text-2xl font-semibold">{value}</div>
        <div className="mt-2 flex min-h-5 items-center gap-2 text-xs">
          {hasDelta ? (
            <>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium tabular-nums",
                  flat
                    ? "bg-muted text-muted-foreground"
                    : good
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                )}
              >
                <DeltaIcon className="h-3 w-3" />
                {formatDelta(deltaPct as number)}
              </span>
              <span className="text-muted-foreground">{hint ?? t.kpi.vsPrevious}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{hint ?? t.kpi.noPrevious}</span>
          )}
        </div>
        {footer ? <p className="mt-1 text-[11px] text-muted-foreground">{footer}</p> : null}
      </CardContent>
    </Card>
  );
}

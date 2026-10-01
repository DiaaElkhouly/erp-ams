import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_CURRENCY = "EGP";
export const CURRENCY_LABEL: Record<string, string> = { EGP: "ج.م", USD: "$", EUR: "€" };

export function formatCurrency(value: number | string, currency = "USD") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(safe);
}

export function formatMoney(value: number | string, currency = DEFAULT_CURRENCY, fractionDigits = 0) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe)} ${CURRENCY_LABEL[currency] ?? currency}`;
}

/** Compact money for chart axes: 1.2M / 45K / 320 */
export function formatCompact(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(safe);
  const sign = safe < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${trimZero(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimZero(abs / 1_000)}K`;
  return `${sign}${trimZero(abs)}`;
}

function trimZero(value: number) {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, "");
}

export function formatNumber(value: number | string, fractionDigits = 0, locale = "en-US") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe);
}

export function formatPercent(value: number | string, fractionDigits = 1) {
  const n = typeof value === "string" ? parseFloat(value) : value;
  const safe = Number.isFinite(n) ? n : 0;
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(safe)}%`;
}

/** Signed percentage-point delta used by the KPI cards. */
export function formatDelta(value: number | null, fractionDigits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value, fractionDigits)}`;
}

/** Relative change between the current and previous window. Null when there is no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export function generateOrderNumber(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

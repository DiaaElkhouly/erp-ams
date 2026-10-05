import {
  addDays, addMonths, differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval,
  eachWeekOfInterval, endOfDay, endOfMonth, format, isValid, parse, startOfDay,
  startOfMonth, startOfWeek, subDays, subMonths,
} from "date-fns";

export type Granularity = "day" | "week" | "month";

export type DateRangePresetId =
  | "today" | "yesterday" | "7d" | "30d" | "90d" | "mtd" | "lastMonth"
  | "6m" | "12m" | "ytd" | "all" | "custom";

export type DateRange = {
  from: Date;
  to: Date;
  /** Days spanned, inclusive. */
  days: number;
  granularity: Granularity;
};

export type DateRangeParams = {
  preset?: string;
  from?: string | null;
  to?: string | null;
  fromTime?: string | null;
  toTime?: string | null;
};

export const DATE_INPUT_FORMAT = "yyyy-MM-dd";
export const TIME_INPUT_FORMAT = "HH:mm";

const isDate = (value: Date) => !Number.isNaN(value.getTime());

function parseDateInput(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parse(value, DATE_INPUT_FORMAT, new Date());
  return isValid(parsed) && isDate(parsed) ? startOfDay(parsed) : null;
}

function parseTimeInput(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return hours * 60 + minutes;
}

function applyTimeOfDay(day: Date, minutesOfDay: number) {
  const result = startOfDay(day);
  result.setMinutes(minutesOfDay);
  return result;
}

/** Granularity is picked from the span so charts never render thousands of points. */
export function resolveGranularity(days: number): Granularity {
  if (days <= 45) return "day";
  if (days <= 210) return "week";
  return "month";
}

export function bucketKey(date: Date, granularity: Granularity) {
  if (granularity === "day") return format(date, DATE_INPUT_FORMAT);
  if (granularity === "week") return format(startOfWeek(date, { weekStartsOn: 0 }), DATE_INPUT_FORMAT);
  return format(date, "yyyy-MM");
}

/**
 * Bucket labels render on both sides of the app: the client-side date filter,
 * and the server-side dashboard and report suites. That module cannot import the
 * React catalog, so callers pass the one word they need instead of the function
 * guessing a language from its own defaults.
 */
export function bucketLabel(date: Date, granularity: Granularity, labels: { week: string }) {
  if (granularity === "day") return format(date, "d MMM");
  if (granularity === "week") return `${labels.week} ${format(date, "d/M")}`;
  return format(date, "MMM yyyy");
}

export function eachBucket(from: Date, to: Date, granularity: Granularity) {
  const interval = { start: startOfDay(from), end: endOfDay(to) };
  if (granularity === "day") return eachDayOfInterval(interval);
  if (granularity === "week") return eachWeekOfInterval(interval, { weekStartsOn: 0 });
  return eachMonthOfInterval(interval);
}

/** Presets are always evaluated against "now" so they stay meaningful after a reload. */
export function resolvePreset(id: string, now = new Date()): { from: Date; to: Date } {
  const today = startOfDay(now);
  const end = endOfDay(now);
  switch (id) {
    case "today": return { from: today, to: end };
    case "yesterday": return { from: subDays(today, 1), to: endOfDay(subDays(today, 1)) };
    case "7d": return { from: startOfDay(subDays(now, 6)), to: end };
    case "30d": return { from: startOfDay(subDays(now, 29)), to: end };
    case "90d": return { from: startOfDay(subDays(now, 89)), to: end };
    case "mtd": return { from: startOfMonth(now), to: end };
    case "lastMonth": {
      const start = startOfMonth(subMonths(now, 1));
      return { from: start, to: endOfMonth(start) };
    }
    case "6m": return { from: startOfMonth(subMonths(now, 5)), to: end };
    case "12m": return { from: startOfMonth(subMonths(now, 11)), to: end };
    case "ytd": return { from: startOfMonth(new Date(now.getFullYear(), 0, 1)), to: end };
    default: return { from: startOfDay(subDays(now, 29)), to: end };
  }
}

export function isPresetValid(id: string): id is DateRangePresetId {
  return ["today", "yesterday", "7d", "30d", "90d", "mtd", "lastMonth", "6m", "12m", "ytd", "all", "custom"]
    .includes(id);
}

/**
 * Builds the effective range from the URL. `all` falls back to the oldest record
 * supplied by the caller, which is why it needs the extra argument.
 */
export function resolveDateRange(params: DateRangeParams, fallbackFrom?: Date, now = new Date()): DateRange {
  const preset = params.preset && isPresetValid(params.preset) ? params.preset : "30d";

  let from: Date;
  let to: Date;

  if (preset === "all") {
    const oldest = fallbackFrom ? startOfDay(fallbackFrom) : subMonths(startOfDay(now), 11);
    from = oldest;
    to = endOfDay(now);
  } else {
    const resolved = resolvePreset(preset, now);
    from = resolved.from;
    to = resolved.to;
  }

  // Explicit inputs always win so "custom" and manual edits stay reproducible/shareable.
  const parsedFrom = parseDateInput(params.from);
  const parsedTo = parseDateInput(params.to);
  if (parsedFrom) from = parsedFrom;
  if (parsedTo) to = endOfDay(parsedTo);
  if (from > to) [from, to] = [to, from];

  from = applyTimeOfDay(from, parseTimeInput(params.fromTime, 0));
  to = applyTimeOfDay(to, parseTimeInput(params.toTime, 24 * 60 - 1));

  const days = Math.max(1, differenceInCalendarDays(endOfDay(to), startOfDay(from)) + 1);
  return { from, to, days, granularity: resolveGranularity(days) };
}

/** The equal-length window immediately before `range`, used for period-over-period deltas. */
export function previousPeriod(range: DateRange): { from: Date; to: Date } {
  const spanMs = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - spanMs - 1), to: new Date(range.from.getTime() - 1) };
}

export function toDateInput(date: Date) {
  return format(date, DATE_INPUT_FORMAT);
}

export function toTimeInput(date: Date) {
  return format(date, TIME_INPUT_FORMAT);
}

export function formatRangeLabel(range: DateRange) {
  return `${format(range.from, "d MMM yyyy")} - ${format(range.to, "d MMM yyyy")}`;
}

export function rangeToParams(range: DateRange): Record<string, string> {
  return {
    from: toDateInput(range.from),
    to: toDateInput(range.to),
    fromTime: toTimeInput(range.from),
    toTime: toTimeInput(range.to),
  };
}

export const EMPTY_BUCKET_VALUE = {
  revenue: 0, cogs: 0, profit: 0, purchases: 0, salesOrders: 0, purchaseOrders: 0,
  unitsSold: 0, productionQty: 0, labTotal: 0, labPassed: 0,
};

export type BucketValue = typeof EMPTY_BUCKET_VALUE;

export function createEmptyBuckets(range: DateRange): Record<string, BucketValue> {
  const buckets: Record<string, BucketValue> = {};
  for (const date of eachBucket(range.from, range.to, range.granularity)) {
    buckets[bucketKey(date, range.granularity)] = { ...EMPTY_BUCKET_VALUE };
  }
  return buckets;
}

export function addMonthsBack(from: Date, months: number) {
  return addMonths(from, -months);
}

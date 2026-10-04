import { describe, expect, it } from "vitest";
import { endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import {
  DATE_INPUT_FORMAT,
  EMPTY_BUCKET_VALUE,
  addMonthsBack,
  bucketKey,
  bucketLabel,
  createEmptyBuckets,
  eachBucket,
  formatRangeLabel,
  isPresetValid,
  previousPeriod,
  rangeToParams,
  resolveDateRange,
  resolveGranularity,
  resolvePreset,
  toDateInput,
  toTimeInput,
  type DateRangePresetId,
  type Granularity,
} from "@/lib/date-range";

/** Local-time construction keeps these assertions timezone-independent. */
const NOW = new Date(2026, 2, 15, 14, 30, 0, 0); // 15 Mar 2026, 14:30 local

const START_OF_TODAY = new Date(2026, 2, 15, 0, 0, 0, 0);
const END_OF_TODAY = new Date(2026, 2, 15, 23, 59, 59, 999);
/**
 * resolveDateRange re-applies the time-of-day window through `setMinutes`,
 * which drops seconds and milliseconds, so its upper bound lands on 23:59:00.
 */
const END_OF_TODAY_MINUTE = new Date(2026, 2, 15, 23, 59, 0, 0);

/** Calendar days a window touches, inclusive of both ends. */
function inclusiveDays(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1;
}

describe("resolvePreset", () => {
  it("today spans midnight to the last millisecond of the day", () => {
    expect(resolvePreset("today", NOW)).toEqual({ from: START_OF_TODAY, to: END_OF_TODAY });
  });

  it("yesterday spans the whole previous day", () => {
    expect(resolvePreset("yesterday", NOW)).toEqual({
      from: new Date(2026, 2, 14, 0, 0, 0, 0),
      to: new Date(2026, 2, 14, 23, 59, 59, 999),
    });
  });

  it.each([
    ["7d", 6],
    ["30d", 29],
    ["90d", 89],
  ])("%s starts %i days back so today is included", (preset, daysBack) => {
    const { from, to } = resolvePreset(preset, NOW);
    expect(inclusiveDays(from, to)).toBe(daysBack + 1);
    expect(startOfDay(from)).toEqual(startOfDay(subDays(NOW, daysBack)));
    expect(to).toEqual(END_OF_TODAY);
  });

  it("mtd starts on the first of the current month", () => {
    const { from, to } = resolvePreset("mtd", NOW);
    expect(from).toEqual(new Date(2026, 2, 1, 0, 0, 0, 0));
    expect(to).toEqual(END_OF_TODAY);
  });

  it("lastMonth covers the previous calendar month in full", () => {
    expect(resolvePreset("lastMonth", NOW)).toEqual({
      from: new Date(2026, 1, 1, 0, 0, 0, 0),
      to: endOfMonth(new Date(2026, 1, 1)),
    });
  });

  it("lastMonth ends on the 31st when the previous month has 31 days", () => {
    const fromFebruary = new Date(2026, 1, 15, 9, 0, 0, 0);
    expect(resolvePreset("lastMonth", fromFebruary).to).toEqual(new Date(2026, 0, 31, 23, 59, 59, 999));
  });

  it.each([
    ["6m", 5],
    ["12m", 11],
  ])("%s starts on the first of the month %i months back", (preset, monthsBack) => {
    const { from, to } = resolvePreset(preset, NOW);
    expect(from).toEqual(startOfMonth(subMonths(NOW, monthsBack)));
    expect(to).toEqual(END_OF_TODAY);
  });

  it("ytd starts on 1 January of the current year", () => {
    expect(resolvePreset("ytd", NOW)).toEqual({
      from: new Date(2026, 0, 1, 0, 0, 0, 0),
      to: END_OF_TODAY,
    });
  });

  it("falls back to 30d for an unknown id", () => {
    expect(resolvePreset("nonsense", NOW)).toEqual(resolvePreset("30d", NOW));
    expect(resolvePreset("", NOW)).toEqual(resolvePreset("30d", NOW));
  });

  it("always returns an end of day and a non-inverted range", () => {
    const ids = ["today", "yesterday", "7d", "30d", "90d", "mtd", "lastMonth", "6m", "12m", "ytd", "garbage"];
    for (const id of ids) {
      const { from, to } = resolvePreset(id, NOW);
      expect(from.getTime(), id).toBeLessThanOrEqual(to.getTime());
      expect(to.getHours(), id).toBe(23);
      expect(to.getMilliseconds(), id).toBe(999);
    }
  });

  it("is evaluated against now, so a reloaded URL still means today", () => {
    expect(resolvePreset("today", NOW).from).toEqual(new Date(2026, 2, 15, 0, 0, 0, 0));
    expect(resolvePreset("today", new Date(2026, 2, 20, 8, 0)).from).toEqual(new Date(2026, 2, 20, 0, 0, 0, 0));
  });
});

describe("isPresetValid", () => {
  const valid: DateRangePresetId[] = [
    "today", "yesterday", "7d", "30d", "90d", "mtd", "lastMonth", "6m", "12m", "ytd", "all", "custom",
  ];

  it.each(valid)("accepts %s", (id) => {
    expect(isPresetValid(id)).toBe(true);
  });

  it.each(["", "1d", "TODAY", "last-week", "week", "30 days"])("rejects %j", (id) => {
    expect(isPresetValid(id)).toBe(false);
  });
});

describe("resolveGranularity", () => {
  it.each<[number, Granularity]>([
    [1, "day"], [7, "day"], [45, "day"],
    [46, "week"], [90, "week"], [210, "week"],
    [211, "month"], [365, "month"],
  ])("%i days -> %s", (days, expected) => {
    expect(resolveGranularity(days)).toBe(expected);
  });
});

describe("resolveDateRange", () => {
  it("defaults to 30d when no preset is supplied", () => {
    expect(resolveDateRange({}, undefined, NOW)).toEqual(resolveDateRange({ preset: "30d" }, undefined, NOW));
  });

  it("defaults to 30d when the preset is unrecognised", () => {
    expect(resolveDateRange({ preset: "last-year" }, undefined, NOW)).toEqual(
      resolveDateRange({ preset: "30d" }, undefined, NOW),
    );
  });

  it("reports inclusive day counts", () => {
    expect(resolveDateRange({ preset: "today" }, undefined, NOW).days).toBe(1);
    expect(resolveDateRange({ preset: "7d" }, undefined, NOW).days).toBe(7);
    expect(resolveDateRange({ preset: "30d" }, undefined, NOW).days).toBe(30);
    expect(resolveDateRange({ preset: "90d" }, undefined, NOW).days).toBe(90);
  });

  it("picks granularity from the resolved span", () => {
    expect(resolveDateRange({ preset: "7d" }, undefined, NOW).granularity).toBe("day");
    expect(resolveDateRange({ preset: "90d" }, undefined, NOW).granularity).toBe("week");
    expect(resolveDateRange({ preset: "6m" }, undefined, NOW).granularity).toBe("week");
    expect(resolveDateRange({ preset: "12m" }, undefined, NOW).granularity).toBe("month");
    expect(resolveDateRange({ preset: "all" }, new Date(2020, 0, 1), NOW).granularity).toBe("month");
  });

  it("all starts at the oldest record when one is supplied", () => {
    const range = resolveDateRange({ preset: "all" }, new Date(2021, 4, 17, 18, 0, 0, 0), NOW);
    expect(range.from).toEqual(new Date(2021, 4, 17, 0, 0, 0, 0));
    expect(range.to).toEqual(END_OF_TODAY_MINUTE);
  });

  // Falls back mid-month, unlike resolvePreset("12m") which snaps to the 1st.
  it("all falls back to 11 months back at the same day-of-month", () => {
    expect(resolveDateRange({ preset: "all" }, undefined, NOW).from).toEqual(new Date(2025, 3, 15, 0, 0, 0, 0));
  });

  it("lets an explicit from/to override the preset", () => {
    const range = resolveDateRange({ preset: "7d", from: "2026-01-01", to: "2026-01-31" }, undefined, NOW);
    expect(range.from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 0, 31, 23, 59, 0, 0));
    expect(range.days).toBe(31);
  });

  it("swaps an inverted from/to instead of returning a negative span", () => {
    const range = resolveDateRange({ from: "2026-03-10", to: "2026-03-01" }, undefined, NOW);
    expect(range.from).toEqual(new Date(2026, 2, 1, 0, 0, 0, 0));
    expect(range.to).toEqual(new Date(2026, 2, 10, 23, 59, 0, 0));
    expect(range.days).toBe(10);
  });

  it("ignores unparseable date input and keeps the preset", () => {
    expect(resolveDateRange({ from: "not-a-date", to: "" }, undefined, NOW)).toEqual(
      resolveDateRange({ preset: "30d" }, undefined, NOW),
    );
  });

  it("applies the time-of-day window without changing the day count", () => {
    const range = resolveDateRange({ preset: "today", fromTime: "08:30", toTime: "17:00" }, undefined, NOW);
    expect(range.from).toEqual(new Date(2026, 2, 15, 8, 30, 0, 0));
    expect(range.to).toEqual(new Date(2026, 2, 15, 17, 0, 0, 0));
    expect(range.days).toBe(1);
  });

  it("defaults the window to 00:00 through the last minute of the day", () => {
    const range = resolveDateRange({ preset: "today" }, undefined, NOW);
    expect(range.from).toEqual(START_OF_TODAY);
    expect(range.to).toEqual(END_OF_TODAY_MINUTE);
    expect(range.to.getSeconds()).toBe(0);
  });

  it.each(["25:00", "08:99", "830", "08-30", "-1:00"])("ignores a malformed time %j", (fromTime) => {
    expect(resolveDateRange({ preset: "today", fromTime }, undefined, NOW).from).toEqual(START_OF_TODAY);
  });

  it("never returns fewer than one day", () => {
    expect(resolveDateRange({ from: "2026-03-15", to: "2026-03-15" }, undefined, NOW).days).toBe(1);
  });
});

describe("previousPeriod", () => {
  it("ends 1ms before the current range starts, so the windows never overlap", () => {
    const range = resolveDateRange({ preset: "30d" }, undefined, NOW);
    expect(previousPeriod(range).to.getTime()).toBe(range.from.getTime() - 1);
  });

  it("covers exactly as many days as the current range", () => {
    for (const preset of ["today", "7d", "30d", "90d", "12m"]) {
      const range = resolveDateRange({ preset }, undefined, NOW);
      const previous = previousPeriod(range);
      expect(inclusiveDays(previous.from, previous.to), preset).toBe(range.days);
      expect(previous.to.getTime() - previous.from.getTime(), preset).toBe(range.to.getTime() - range.from.getTime());
    }
  });

  it("sits entirely before the current range", () => {
    const range = resolveDateRange({ preset: "7d" }, undefined, NOW);
    const previous = previousPeriod(range);
    expect(previous.to.getTime()).toBeLessThan(range.from.getTime());
    expect(previous.from.getTime()).toBeLessThan(range.from.getTime());
  });
});

describe("bucketing", () => {
  it.each<[Granularity, string]>([
    ["day", "2026-03-15"],
    ["week", "2026-03-15"],
    ["month", "2026-03"],
  ])("%s bucket key", (granularity, expected) => {
    expect(bucketKey(NOW, granularity)).toBe(expected);
  });

  it("keys weeks by their Sunday start", () => {
    // 15 Mar 2026 is a Sunday, so the whole of that week keys to 15 Mar.
    expect(bucketKey(new Date(2026, 2, 15), "week")).toBe("2026-03-15");
    expect(bucketKey(new Date(2026, 2, 16), "week")).toBe("2026-03-15");
    expect(bucketKey(new Date(2026, 2, 21), "week")).toBe("2026-03-15");
    expect(bucketKey(new Date(2026, 2, 22), "week")).toBe("2026-03-22");
  });

  it("produces yyyy-MM-dd keys that sort lexicographically", () => {
    expect(DATE_INPUT_FORMAT).toBe("yyyy-MM-dd");
    const keys = [bucketKey(new Date(2026, 0, 9), "day"), bucketKey(new Date(2026, 0, 10), "day")];
    expect([...keys].sort()).toEqual(keys);
  });

  it("labels buckets per granularity", () => {
    expect(bucketLabel(NOW, "day")).toBe("15 Mar");
    expect(bucketLabel(NOW, "week")).toBe("أسبوع 15/3");
    expect(bucketLabel(NOW, "month")).toBe("Mar 2026");
  });

  it("emits one bucket per day across a 7-day range", () => {
    const range = resolveDateRange({ preset: "7d" }, undefined, NOW);
    expect(eachBucket(range.from, range.to, "day")).toHaveLength(7);
    expect(eachBucket(range.from, range.to, range.granularity)).toHaveLength(7);
  });

  it("emits one bucket per month across a 12-month range", () => {
    const range = resolveDateRange({ preset: "12m" }, undefined, NOW);
    expect(eachBucket(range.from, range.to, "month")).toHaveLength(12);
    expect(bucketKey(range.from, "month")).toBe("2025-04");
    expect(bucketKey(range.to, "month")).toBe("2026-03");
  });

  it("createEmptyBuckets fills every bucket with zeroes", () => {
    const buckets = createEmptyBuckets(resolveDateRange({ preset: "7d" }, undefined, NOW));
    expect(Object.keys(buckets)).toHaveLength(7);
    for (const value of Object.values(buckets)) {
      expect(value).toEqual(EMPTY_BUCKET_VALUE);
    }
  });

  it("does not share object references between buckets", () => {
    const buckets = createEmptyBuckets(resolveDateRange({ preset: "7d" }, undefined, NOW));
    const keys = Object.keys(buckets);
    buckets[keys[0]].revenue = 500;
    expect(buckets[keys[1]].revenue).toBe(0);
    expect(EMPTY_BUCKET_VALUE.revenue).toBe(0);
  });
});

describe("serialisation helpers", () => {
  it("toDateInput emits yyyy-MM-dd", () => {
    expect(toDateInput(NOW)).toBe("2026-03-15");
  });

  it("toTimeInput emits HH:mm", () => {
    expect(toTimeInput(new Date(2026, 2, 15, 8, 5, 0, 0))).toBe("08:05");
  });

  it("rangeToParams emits all four fields", () => {
    const range = resolveDateRange({ preset: "today", fromTime: "08:00", toTime: "17:00" }, undefined, NOW);
    expect(rangeToParams(range)).toEqual({
      from: "2026-03-15",
      to: "2026-03-15",
      fromTime: "08:00",
      toTime: "17:00",
    });
  });

  it("a rangeToParams payload resolves back to the same window", () => {
    const range = resolveDateRange({ preset: "30d" }, undefined, NOW);
    const round = resolveDateRange({ preset: "custom", ...rangeToParams(range) }, undefined, NOW);
    expect(toDateInput(round.from)).toBe(toDateInput(range.from));
    expect(toTimeInput(round.from)).toBe(toTimeInput(range.from));
    expect(toDateInput(round.to)).toBe(toDateInput(range.to));
    expect(toTimeInput(round.to)).toBe(toTimeInput(range.to));
    expect(round.days).toBe(range.days);
    expect(round.granularity).toBe(range.granularity);
  });

  it("formatRangeLabel renders both ends", () => {
    const label = formatRangeLabel(resolveDateRange({ preset: "30d" }, undefined, NOW));
    expect(label).toBe("14 Feb 2026 - 15 Mar 2026");
  });

  it("addMonthsBack subtracts whole months", () => {
    expect(addMonthsBack(new Date(2026, 2, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(addMonthsBack(NOW, 0)).toEqual(NOW);
  });
});
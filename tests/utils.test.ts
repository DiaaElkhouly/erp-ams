import { describe, expect, it, vi } from "vitest";
import {
  CURRENCY_LABEL,
  DEFAULT_CURRENCY,
  cn,
  formatCompact,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDelta,
  formatMoney,
  formatNumber,
  formatPercent,
  generateOrderNumber,
  percentChange,
} from "@/lib/utils";

describe("formatCurrency", () => {
  it("renders a symbol and thousands separators with no decimals", () => {
    expect(formatCurrency(1234.56, "USD")).toBe("$1,235");
    expect(formatCurrency(0, "USD")).toBe("$0");
  });

  it("keeps the sign outside the symbol", () => {
    expect(formatCurrency(-99.5, "USD")).toBe("-$100");
  });

  it("accepts decimal strings from Prisma", () => {
    expect(formatCurrency("1234.56", "USD")).toBe("$1,235");
    expect(formatCurrency("42", "EUR")).toBe("€42");
  });

  it("falls back to 0 for values that are not finite", () => {
    expect(formatCurrency(Number.NaN, "USD")).toBe("$0");
    expect(formatCurrency(Number.POSITIVE_INFINITY, "USD")).toBe("$0");
    expect(formatCurrency("not-a-number", "USD")).toBe("$0");
  });

  // The default is USD while DEFAULT_CURRENCY is EGP. Pinned so the
  // inconsistency is visible rather than silently changed.
  it("defaults to USD, not DEFAULT_CURRENCY", () => {
    expect(formatCurrency(10)).toBe(formatCurrency(10, "USD"));
    expect(formatCurrency(10)).not.toBe(formatCurrency(10, DEFAULT_CURRENCY));
  });
});

describe("formatMoney", () => {
  it("uses the Egyptian pound label by default", () => {
    expect(formatMoney(1234.5)).toBe("1,235 ج.م");
    expect(DEFAULT_CURRENCY).toBe("EGP");
  });

  it("honours the fraction digit argument", () => {
    expect(formatMoney(1234.5, "EGP", 2)).toBe("1,234.50 ج.م");
    expect(formatMoney(-40, "EGP")).toBe("-40 ج.م");
  });

  it("falls back to the raw code for an unknown currency", () => {
    expect(formatMoney(10, "GBP")).toBe("10 GBP");
  });

  it("parses decimal strings", () => {
    expect(formatMoney("1999.99")).toBe("2,000 ج.م");
  });

  it("maps every labelled currency", () => {
    expect(Object.keys(CURRENCY_LABEL).sort()).toEqual(["EGP", "EUR", "USD"]);
  });
});

describe("formatCompact", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [99.4, "99.4"],
    [320, "320"],
    [999, "999"],
    [1000, "1K"],
    [1234, "1.2K"],
    [45_000, "45K"],
    [1_200_000, "1.2M"],
    [999_999, "1000K"],
  ])("%i -> %s", (value, expected) => {
    expect(formatCompact(value)).toBe(expected);
  });

  it("keeps the sign for negatives", () => {
    expect(formatCompact(-1500)).toBe("-1.5K");
    expect(formatCompact(-2_000_000)).toBe("-2M");
  });

  it("rounds rather than truncates above 100", () => {
    expect(formatCompact(999_500)).toBe("1000K");
  });

  it("falls back to 0 for non-finite input", () => {
    expect(formatCompact(Number.NaN)).toBe("0");
  });
});

describe("formatNumber", () => {
  it("defaults to no decimals", () => {
    expect(formatNumber(1234.567)).toBe("1,235");
    expect(formatNumber(-1234.567)).toBe("-1,235");
  });

  it("respects the fraction digit argument", () => {
    expect(formatNumber(1234.567, 2)).toBe("1,234.57");
    expect(formatNumber(3, 2)).toBe("3.00");
  });

  it("parses decimal strings", () => {
    expect(formatNumber("1234.5")).toBe("1,235");
    expect(formatNumber("12.34", 2)).toBe("12.34");
  });

  it("falls back to 0 for junk", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
    expect(formatNumber("abc")).toBe("0");
    expect(formatNumber("")).toBe("0");
  });

  it("honours the locale argument", () => {
    expect(formatNumber(1234.5, 0, "en-US")).toBe("1,235");
  });
});

describe("formatPercent", () => {
  it("appends a percent sign with one decimal by default", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
    expect(formatPercent(7)).toBe("7.0%");
    expect(formatPercent(-3)).toBe("-3.0%");
  });

  it("respects the fraction digit argument", () => {
    expect(formatPercent(12.345, 2)).toBe("12.35%");
    expect(formatPercent(12.345, 0)).toBe("12%");
  });

  it("parses decimal strings", () => {
    expect(formatPercent("45.5")).toBe("45.5%");
  });

  it("falls back to 0 for junk", () => {
    expect(formatPercent(Number.NaN)).toBe("0.0%");
  });
});

describe("formatDelta", () => {
  it("signs positive deltas explicitly", () => {
    expect(formatDelta(5)).toBe("+5.0%");
  });

  it("leaves zero and negatives unsigned at the front", () => {
    expect(formatDelta(0)).toBe("0.0%");
    expect(formatDelta(-5)).toBe("-5.0%");
  });

  it("returns null when there is no comparison value", () => {
    expect(formatDelta(null)).toBeNull();
    expect(formatDelta(Number.NaN)).toBeNull();
  });
});

describe("percentChange", () => {
  it("computes the relative change", () => {
    expect(percentChange(110, 100)).toBeCloseTo(10);
    expect(percentChange(50, 100)).toBeCloseTo(-50);
    expect(percentChange(100, 200)).toBeCloseTo(-50);
  });

  it("uses the magnitude of a negative baseline", () => {
    expect(percentChange(-50, -100)).toBeCloseTo(50);
  });

  it("returns null without a usable baseline", () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, Number.NaN)).toBeNull();
    expect(percentChange(Number.NaN, 100)).toBeNull();
  });
});

describe("formatDate", () => {
  it("renders an unambiguous en-US date", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("Jan 5, 2026");
    expect(formatDate(new Date(2026, 10, 30))).toBe("Nov 30, 2026");
  });

  it("accepts an ISO string", () => {
    expect(formatDate("2026-01-05T00:00:00.000Z")).toMatch(/^\w{3} \d{1,2}, \d{4}$/);
  });
});

describe("formatDateTime", () => {
  it("includes a 12-hour clock time", () => {
    expect(formatDateTime(new Date(2026, 0, 5, 14, 30))).toBe("Jan 5, 2026, 02:30 PM");
    expect(formatDateTime(new Date(2026, 0, 5, 9, 5))).toBe("Jan 5, 2026, 09:05 AM");
  });

  it("accepts a string", () => {
    expect(formatDateTime("2026-01-05T00:00:00.000Z")).toMatch(/\d{2}:\d{2} (AM|PM)$/);
  });
});

describe("generateOrderNumber", () => {
  it("prefixes the stamp with the caller-supplied code", () => {
    expect(generateOrderNumber("WO")).toMatch(/^WO-[0-9A-Z]+-[0-9A-Z]{1,}$/);
    expect(generateOrderNumber("SO")).toMatch(/^SO-/);
  });

  it("has three fields and a non-empty random suffix", () => {
    const [prefix, stamp, suffix] = generateOrderNumber("WO").split("-");
    expect(prefix).toBe("WO");
    expect(stamp.length).toBeGreaterThan(0);
    expect(suffix.length).toBeGreaterThan(0);
  });

  it("avoids separator collisions in the base36 alphabet", () => {
    expect(generateOrderNumber("WO")).not.toContain("--");
  });

  // The random suffix is only three base36 chars (~46k values), so uniqueness
  // within a single millisecond is not guaranteed by luck. WorkOrder.orderNumber
  // is @unique, so assert the composition rather than sampling for absence of
  // collisions, which would be a flaky test.
  it("stays unique when the clock advances and the random stream differs", () => {
    let tick = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => 1_800_000_000_000 + tick++);
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => tick / 1e6);

    try {
      const numbers = Array.from({ length: 500 }, () => generateOrderNumber("WO"));
      expect(new Set(numbers).size).toBe(500);
    } finally {
      nowSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });
});

describe("cn", () => {
  it("merges conditional class names", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "font-bold", undefined, "font-medium")).toBe("text-sm font-medium");
  });

  it("passes a plain list through tailwind-merge", () => {
    expect(cn("rounded-md", "border")).toBe("rounded-md border");
  });
});
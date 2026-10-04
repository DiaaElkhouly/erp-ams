import { describe, expect, it } from "vitest";
import {
  BOM_QTY_SCALE,
  NEGATIVE_STOCK_POLICY,
  assertStockDelta,
  consumptionQtyFromScaled,
  normalizeScrapQty,
  toScaledQty,
  wouldGoNegative,
} from "@/lib/inventory/stock-rules";

describe("negative stock policy", () => {
  it("is the single block policy", () => {
    expect(NEGATIVE_STOCK_POLICY).toBe("block");
  });

  it("flags a movement that would leave on-hand below zero", () => {
    expect(wouldGoNegative(5, -6)).toBe(true);
    expect(wouldGoNegative(5, -5)).toBe(false);
    expect(wouldGoNegative(5, 10)).toBe(false);
    expect(wouldGoNegative(0, -1)).toBe(true);
  });
});

describe("assertStockDelta", () => {
  it("rejects fractional units", () => {
    expect(() => assertStockDelta(1.5)).toThrow(TypeError);
  });

  it("rejects a zero movement rather than writing a meaningless ledger row", () => {
    expect(() => assertStockDelta(0)).toThrow(/must not be zero/);
  });

  it("accepts signed whole numbers", () => {
    expect(() => assertStockDelta(-3)).not.toThrow();
    expect(() => assertStockDelta(7)).not.toThrow();
  });
});

describe("BOM quantity scaling", () => {
  it("scales Decimal(14,3) quantities into integer thousandths", () => {
    expect(BOM_QTY_SCALE).toBe(1000);
    expect(toScaledQty(2.5)).toBe(2500);
    expect(toScaledQty("0.425")).toBe(425);
  });

  it("rejects negative or non-numeric BOM quantities", () => {
    expect(() => toScaledQty(-1)).toThrow(RangeError);
    expect(() => toScaledQty("not a number")).toThrow(RangeError);
  });

  it("rounds consumption up so a recipe is never under-consumed", () => {
    expect(consumptionQtyFromScaled(2500)).toBe(3);
    expect(consumptionQtyFromScaled(3000)).toBe(3);
    expect(consumptionQtyFromScaled(3001)).toBe(4);
    expect(consumptionQtyFromScaled(425)).toBe(1);
  });

  it("avoids floating point drift on a 0.1 recipe scaled by 3", () => {
    // 0.1 * 1000 * 3 = 300.00000000000006 in binary floating point.
    expect(toScaledQty(0.1) * 3).toBe(300);
    expect(consumptionQtyFromScaled(toScaledQty(0.1) * 3)).toBe(1);
  });
});

describe("normalizeScrapQty", () => {
  it("defaults to no scrap", () => {
    expect(normalizeScrapQty(undefined, 10)).toBe(0);
  });

  it("accepts scrap below the order quantity", () => {
    expect(normalizeScrapQty(0, 10)).toBe(0);
    expect(normalizeScrapQty(3, 10)).toBe(3);
    expect(normalizeScrapQty(9, 10)).toBe(9);
  });

  it("rejects scrap that would consume the entire output", () => {
    expect(() => normalizeScrapQty(10, 10)).toThrow(/must be less than/);
    expect(() => normalizeScrapQty(11, 10)).toThrow(/must be less than/);
  });

  it("rejects fractional or negative scrap", () => {
    expect(() => normalizeScrapQty(1.5, 10)).toThrow(RangeError);
    expect(() => normalizeScrapQty(-1, 10)).toThrow(RangeError);
  });
});
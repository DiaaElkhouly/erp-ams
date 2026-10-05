import { describe, expect, it } from "vitest";
import {
  isBelowReorderPoint,
  planReorderAlerts,
  reorderSeverity,
  shortfall,
  type ReorderSubject,
} from "@/lib/notifications/reorder";

function item(overrides: Partial<ReorderSubject> & { itemId: string }): ReorderSubject {
  return {
    sku: overrides.itemId.toUpperCase(),
    name: `Item ${overrides.itemId}`,
    onHandQty: 100,
    reorderPoint: 10,
    reorderQty: 50,
    ...overrides,
  };
}

describe("the reorder threshold", () => {
  it("counts being exactly at the reorder point as below it", () => {
    // Inclusive on purpose: "at the reorder point" is the moment the buyer is
    // already late. Waiting for on-hand to fall below it delays the order by one
    // whole reorder cycle.
    expect(isBelowReorderPoint(10, 10)).toBe(true);
    expect(isBelowReorderPoint(9, 10)).toBe(true);
    expect(isBelowReorderPoint(11, 10)).toBe(false);
  });

  it("reports the gap to the threshold and never goes negative", () => {
    expect(shortfall(4, 10)).toBe(6);
    expect(shortfall(10, 10)).toBe(0);
    expect(shortfall(25, 10)).toBe(0);
  });

  it("splits severity at half the reorder point, matching the reports module", () => {
    expect(reorderSeverity(4, 10)).toBe("CRITICAL");
    expect(reorderSeverity(6, 10)).toBe("WARNING");
    expect(reorderSeverity(40, 10)).toBe("WARNING");
  });
});

describe("planReorderAlerts", () => {
  it("alerts when a movement pushes an item below its reorder point", () => {
    const alerts = planReorderAlerts(
      [item({ itemId: "cement", onHandQty: 60, reorderPoint: 50 })],
      [item({ itemId: "cement", onHandQty: 45, reorderPoint: 50 })],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      type: "REORDER_BREACH",
      itemId: "cement",
      onHandQty: 45,
      shortfall: 5,
    });
  });

  it("suggests the larger of the reorder quantity and the gap", () => {
    // Matches the MRP rule: ordering less than the configured reorder quantity
    // would not clear the threshold in one delivery.
    const [gapOnly] = planReorderAlerts(
      [item({ itemId: "a", onHandQty: 30, reorderPoint: 20, reorderQty: 5 })],
      [item({ itemId: "a", onHandQty: 10, reorderPoint: 20, reorderQty: 5 })],
    );
    expect(gapOnly.suggestedQty).toBe(10);

    const [bulkOrder] = planReorderAlerts(
      [item({ itemId: "b", onHandQty: 30, reorderPoint: 20, reorderQty: 500 })],
      [item({ itemId: "b", onHandQty: 10, reorderPoint: 20, reorderQty: 500 })],
    );
    expect(bulkOrder.suggestedQty).toBe(500);
  });

  it("stays silent for an item that was already below the threshold", () => {
    // The regression this prevents: a plant floor runs dozens of movements an
    // hour, and re-alerting on every one of them for an item that has been short
    // all week is how a bell gets ignored.
    const alerts = planReorderAlerts(
      [item({ itemId: "cement", onHandQty: 5, reorderPoint: 50 })],
      [item({ itemId: "cement", onHandQty: 3, reorderPoint: 50 })],
    );
    expect(alerts).toEqual([]);
  });

  it("reports recovery when a receipt puts an item back above the threshold", () => {
    const alerts = planReorderAlerts(
      [item({ itemId: "cement", onHandQty: 40, reorderPoint: 50 })],
      [item({ itemId: "cement", onHandQty: 90, reorderPoint: 50 })],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ type: "REORDER_RECOVERED", severity: "INFO", shortfall: 0 });
  });

  it("treats landing exactly on the threshold as a breach, not a recovery", () => {
    const alerts = planReorderAlerts(
      [item({ itemId: "cement", onHandQty: 60, reorderPoint: 50 })],
      [item({ itemId: "cement", onHandQty: 50, reorderPoint: 50 })],
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("REORDER_BREACH");
  });

  it("ignores items the movement did not touch", () => {
    // An item absent from the "before" reading was not part of this transaction.
    // It may well be short, but nothing about it changed here.
    const alerts = planReorderAlerts(
      [],
      [item({ itemId: "cement", onHandQty: 1, reorderPoint: 50 })],
    );
    expect(alerts).toEqual([]);
  });

  it("returns results in a stable order so two identical runs diff cleanly", () => {
    const alerts = planReorderAlerts(
      [item({ itemId: "sand", onHandQty: 60 }), item({ itemId: "cement", onHandQty: 60 })],
      [item({ itemId: "sand", onHandQty: 1 }), item({ itemId: "cement", onHandQty: 2 })],
    );
    expect(alerts.map((a) => a.itemId)).toEqual(["cement", "sand"]);
  });

  it("handles a movement that breaches and recovers different items at once", () => {
    const alerts = planReorderAlerts(
      [
        item({ itemId: "a-going-short", onHandQty: 60, reorderPoint: 50 }),
        item({ itemId: "b-being-restocked", onHandQty: 10, reorderPoint: 50 }),
        item({ itemId: "c-untouched", onHandQty: 500, reorderPoint: 50 }),
      ],
      [
        item({ itemId: "a-going-short", onHandQty: 45, reorderPoint: 50 }),
        item({ itemId: "b-being-restocked", onHandQty: 120, reorderPoint: 50 }),
        item({ itemId: "c-untouched", onHandQty: 490, reorderPoint: 50 }),
      ],
    );
    expect(alerts.map((a) => [a.itemId, a.type])).toEqual([
      ["a-going-short", "REORDER_BREACH"],
      ["b-being-restocked", "REORDER_RECOVERED"],
    ]);
  });
});
import { describe, expect, it } from "vitest";
import { planPurchaseOrdersFromMrp, type MrpLineDraft } from "@/lib/inventory/mrp-to-po";

const STEEL = "supplier-steel";
const CEMENT = "supplier-cement";

function line(overrides: Partial<MrpLineDraft> & { id: string; itemId: string }): MrpLineDraft {
  return { suggestedQty: 100, supplierId: STEEL, purchaseOrderId: null, ...overrides };
}

describe("planPurchaseOrdersFromMrp", () => {
  it("groups lines from one supplier into a single draft order", () => {
    const { drafts } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-sheet" }),
      line({ id: "l2", itemId: "item-bolt" }),
    ]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].supplierId).toBe(STEEL);
    expect(drafts[0].lines.map((l) => l.itemId)).toEqual(["item-bolt", "item-sheet"]);
  });

  it("produces one order per supplier", () => {
    const { drafts } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-sheet", supplierId: STEEL }),
      line({ id: "l2", itemId: "item-cement", supplierId: CEMENT }),
    ]);
    expect(drafts.map((d) => d.supplierId)).toEqual([CEMENT, STEEL]);
  });

  it("carries the suggested quantity and the item's cost onto each line", () => {
    const { drafts } = planPurchaseOrdersFromMrp(
      [line({ id: "l1", itemId: "item-sheet", suggestedQty: 250 })],
      { unitCostByItem: { "item-sheet": 12.5 } },
    );
    expect(drafts[0].lines[0]).toEqual({ itemId: "item-sheet", quantity: 250, unitCost: 12.5 });
  });

  it("reports which run lines went into which order", () => {
    // This is what lets the route link each generated PO back to the suggestions
    // it came from, which in turn is what stops a second click buying it twice.
    const { drafts } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-sheet", supplierId: STEEL }),
      line({ id: "l2", itemId: "item-cement", supplierId: CEMENT }),
    ]);
    expect(drafts.find((d) => d.supplierId === STEEL)?.lineIds).toEqual(["l1"]);
    expect(drafts.find((d) => d.supplierId === CEMENT)?.lineIds).toEqual(["l2"]);
  });

  it("skips a line that is already on a purchase order", () => {
    const { drafts, skipped } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-sheet", purchaseOrderId: "po-existing" }),
      line({ id: "l2", itemId: "item-bolt" }),
    ]);
    expect(drafts[0].lines.map((l) => l.itemId)).toEqual(["item-bolt"]);
    expect(skipped).toEqual([{ lineId: "l1", itemId: "item-sheet", reason: "already-ordered" }]);
  });

  it("skips rather than guessing when an item has no preferred supplier", () => {
    // Assigning it anywhere would send a cement order to the steel supplier's
    // account, which is worse than generating nothing.
    const { drafts, skipped } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-unassigned", supplierId: null }),
    ]);
    expect(drafts).toEqual([]);
    expect(skipped).toEqual([{ lineId: "l1", itemId: "item-unassigned", reason: "no-supplier" }]);
  });

  it("uses the caller's fallback supplier when one is named", () => {
    const { drafts, skipped } = planPurchaseOrdersFromMrp(
      [
        line({ id: "l1", itemId: "item-unassigned", supplierId: null }),
        line({ id: "l2", itemId: "item-sheet", supplierId: STEEL }),
      ],
      { fallbackSupplierId: CEMENT },
    );
    expect(skipped).toEqual([]);
    expect(drafts.map((d) => d.supplierId)).toEqual([CEMENT, STEEL]);
    expect(drafts.find((d) => d.supplierId === CEMENT)?.lines[0].itemId).toBe("item-unassigned");
  });

  it("skips lines with nothing to order", () => {
    const { drafts, skipped } = planPurchaseOrdersFromMrp([
      line({ id: "l1", itemId: "item-zero", suggestedQty: 0 }),
      line({ id: "l2", itemId: "item-negative", suggestedQty: -5 }),
      line({ id: "l3", itemId: "item-fractional", suggestedQty: 2.5 }),
    ]);
    expect(drafts).toEqual([]);
    expect(skipped.map((s) => s.reason)).toEqual([
      "nothing-to-order",
      "nothing-to-order",
      "nothing-to-order",
    ]);
  });

  it("is deterministic, so two identical runs diff cleanly", () => {
    const input = [
      line({ id: "l3", itemId: "item-z", supplierId: CEMENT }),
      line({ id: "l1", itemId: "item-a", supplierId: STEEL }),
      line({ id: "l2", itemId: "item-b", supplierId: CEMENT }),
    ];
    expect(planPurchaseOrdersFromMrp(input)).toEqual(planPurchaseOrdersFromMrp(input));
    expect(planPurchaseOrdersFromMrp(input).drafts[0].lineIds).toEqual(["l2", "l3"]);
  });

  it("plans nothing for an empty run", () => {
    expect(planPurchaseOrdersFromMrp([])).toEqual({ drafts: [], skipped: [] });
  });
});
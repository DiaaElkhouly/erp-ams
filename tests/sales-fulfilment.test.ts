import { describe, expect, it } from "vitest";
import { planSalesFulfilment } from "@/lib/inventory/sales-fulfilment";

const WAREHOUSE = "wh-main";

const order = { id: "so-1", orderNumber: "SO-0001" };

const lines = [
  { id: "line-1", itemId: "item-block-20", quantity: 10, costPrice: 45 },
  { id: "line-2", itemId: "item-cement", quantity: 4, costPrice: "6.75" },
];

describe("planSalesFulfilment", () => {
  it("issues every line out of the given warehouse", () => {
    const { movements } = planSalesFulfilment(order, lines, WAREHOUSE);
    expect(movements).toHaveLength(2);
    for (const movement of movements) {
      expect(movement.warehouseId).toBe(WAREHOUSE);
      expect(movement.reason).toBe("SALES_ISSUE");
      expect(movement.refType).toBe("SALES_ORDER");
      expect(movement.refId).toBe("so-1");
    }
  });

  it("removes stock in proportion to each line quantity", () => {
    const { movements } = planSalesFulfilment(order, lines, WAREHOUSE);
    expect(movements[0]).toMatchObject({ itemId: "item-block-20", qtyDelta: -10 });
    expect(movements[1]).toMatchObject({ itemId: "item-cement", qtyDelta: -4 });
  });

  it("freezes each line's cost onto the order so margin stops tracking the item master", () => {
    const { costSnapshots } = planSalesFulfilment(order, lines, WAREHOUSE);
    expect(costSnapshots).toEqual([
      { id: "line-1", unitCost: 45 },
      { id: "line-2", unitCost: 6.75 },
    ]);
  });

  it("normalises a Decimal cost string to a number", () => {
    const { costSnapshots } = planSalesFulfilment(order, lines, WAREHOUSE);
    expect(typeof costSnapshots[1].unitCost).toBe("number");
  });

  it("plans nothing for an order with no lines", () => {
    const plan = planSalesFulfilment(order, [], WAREHOUSE);
    expect(plan.movements).toEqual([]);
    expect(plan.costSnapshots).toEqual([]);
  });
});
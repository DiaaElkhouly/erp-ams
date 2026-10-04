import { describe, expect, it } from "vitest";
import { planWorkOrderCompletion } from "@/lib/inventory/work-order-completion";

/**
 * The planner is pure, so the ordering and arithmetic that decide whether a
 * completion succeeds are assertable without a database.
 */

const WAREHOUSE = "wh-prod";
const BLOCK = "item-block-20";

const order = {
  orderId: "wo-1",
  orderNumber: "WO-0001",
  warehouseId: WAREHOUSE,
  quantity: 10,
  finishedItemId: BLOCK,
  components: [
    { itemId: "item-cement", quantity: "0.425" },
    { itemId: "item-sand", quantity: 2 },
  ],
};

const reasons = (m: { reason: string }[]) => m.map((x) => x.reason);

describe("planWorkOrderCompletion", () => {
  it("consumes components before it credits any output", () => {
    const movements = planWorkOrderCompletion(order);
    expect(reasons(movements)).toEqual([
      "PRODUCTION_CONSUMPTION",
      "PRODUCTION_CONSUMPTION",
      "PRODUCTION_OUTPUT",
    ]);
  });

  it("scales component requirements by the order quantity", () => {
    const movements = planWorkOrderCompletion(order);
    // 0.425 * 10 = 4.25 -> rounds up to 5 whole bags.
    expect(movements[0]).toMatchObject({ itemId: "item-cement", qtyDelta: -5 });
    expect(movements[1]).toMatchObject({ itemId: "item-sand", qtyDelta: -20 });
  });

  it("credits the gross output to the BOM's finished good", () => {
    const movements = planWorkOrderCompletion(order);
    expect(movements.at(-1)).toMatchObject({
      itemId: BLOCK,
      qtyDelta: 10,
      reason: "PRODUCTION_OUTPUT",
    });
  });

  it("stamps every movement with the work order reference", () => {
    for (const movement of planWorkOrderCompletion(order)) {
      expect(movement.refType).toBe("WORK_ORDER");
      expect(movement.refId).toBe("wo-1");
      expect(movement.warehouseId).toBe(WAREHOUSE);
    }
  });

  it("writes scrap off after the output, never netted into it", () => {
    const movements = planWorkOrderCompletion(order, 2);
    expect(reasons(movements)).toEqual([
      "PRODUCTION_CONSUMPTION",
      "PRODUCTION_CONSUMPTION",
      "PRODUCTION_OUTPUT",
      "SCRAP_WRITEOFF",
    ]);
    expect(movements.at(-1)).toMatchObject({ itemId: BLOCK, qtyDelta: -2 });
  });

  it("leaves the net stock effect of output plus scrap at quantity - scrap", () => {
    const movements = planWorkOrderCompletion(order, 3);
    const finished = movements.filter((m) => m.itemId === BLOCK);
    expect(finished.reduce((sum, m) => sum + m.qtyDelta, 0)).toBe(7);
  });

  it("rejects scrap that would consume the whole output", () => {
    expect(() => planWorkOrderCompletion(order, 10)).toThrow(/must be less than/);
  });

  it("omits a scrap movement when there is no scrap", () => {
    expect(planWorkOrderCompletion(order)).not.toContainEqual(
      expect.objectContaining({ reason: "SCRAP_WRITEOFF" }),
    );
  });

  it("skips a component whose requirement rounds down to nothing", () => {
    const movements = planWorkOrderCompletion({ ...order, components: [{ itemId: "item-glue", quantity: "0.0001" }] });
    expect(reasons(movements)).toEqual(["PRODUCTION_OUTPUT"]);
  });
});
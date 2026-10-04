import type { Prisma } from "@prisma/client";
import type { StockMovementInput } from "@/lib/inventory/stock-service";
import {
  consumptionQtyFromScaled,
  normalizeScrapQty,
  toScaledQty,
} from "@/lib/inventory/stock-rules";

export type BomComponentDraft = {
  itemId: string;
  /**
   * Decimal(14,3) from Prisma, accepted as a string or a number. The planner
   * scales it in integer thousandths rather than trusting float arithmetic.
   */
  quantity: Prisma.Decimal | number | string;
};

export type WorkOrderCompletionInput = {
  orderId: string;
  orderNumber: string;
  warehouseId: string;
  /** Units ordered, gross of scrap. */
  quantity: number;
  /** The BOM's finished good, which must already have been checked against itemId. */
  finishedItemId: string;
  components: BomComponentDraft[];
};

/**
 * Turns a work-order completion into the exact movements it implies. Pure, so the
 * arithmetic and the ordering can be tested without a database.
 *
 * Order is load-bearing:
 *   1. consume components - if raw material is short the transaction aborts before
 *      any finished stock is credited;
 *   2. credit the gross output;
 *   3. write off scrap against that output.
 *
 * Scrap is written off *after* the output rather than netted out of it, so the
 * ledger records that the order produced `quantity` and rejected `scrapQty` of
 * it. It also means the write-off can never trip the negative-stock check: the
 * units it removes were credited a statement earlier in the same transaction.
 */
export function planWorkOrderCompletion(
  workOrder: WorkOrderCompletionInput,
  scrapQty?: number,
): StockMovementInput[] {
  const scrap = normalizeScrapQty(scrapQty, workOrder.quantity);
  const ref = { refType: "WORK_ORDER", refId: workOrder.orderId };
  const movements: StockMovementInput[] = [];

  for (const component of workOrder.components) {
    const scaled = toScaledQty(component.quantity) * workOrder.quantity;
    const required = consumptionQtyFromScaled(scaled);
    if (required === 0) continue;
    movements.push({
      itemId: component.itemId,
      warehouseId: workOrder.warehouseId,
      qtyDelta: -required,
      reason: "PRODUCTION_CONSUMPTION",
      ...ref,
      note: `Consumed by work order ${workOrder.orderNumber}`,
    });
  }

  movements.push({
    itemId: workOrder.finishedItemId,
    warehouseId: workOrder.warehouseId,
    qtyDelta: workOrder.quantity,
    reason: "PRODUCTION_OUTPUT",
    ...ref,
    note: `Produced by work order ${workOrder.orderNumber}`,
  });

  if (scrap > 0) {
    movements.push({
      itemId: workOrder.finishedItemId,
      warehouseId: workOrder.warehouseId,
      qtyDelta: -scrap,
      reason: "SCRAP_WRITEOFF",
      ...ref,
      note: `Scrapped at completion of work order ${workOrder.orderNumber}`,
    });
  }

  return movements;
}
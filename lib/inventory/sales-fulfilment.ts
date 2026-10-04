import type { Prisma } from "@prisma/client";
import type { StockMovementInput } from "@/lib/inventory/stock-service";

export type SalesLineDraft = {
  id: string;
  itemId: string;
  quantity: number;
  /**
   * Item.costPrice at fulfilment time, frozen onto the line. Prisma returns a
   * Decimal.js instance, so plain numbers and strings are accepted too for tests.
   */
  costPrice: Prisma.Decimal | number | string;
};

export type SalesFulfilmentPlan = {
  movements: StockMovementInput[];
  /** Written to SalesOrderLine.unitCost so historical margin stops tracking the item master. */
  costSnapshots: { id: string; unitCost: number }[];
};

/**
 * What fulfilling a sales order does: issue each line from stock and freeze the
 * cost it was issued at.
 *
 * The snapshot is taken from the item's cost at the moment of fulfilment, which
 * is what makes the reported margin for that order reproducible afterwards.
 */
export function planSalesFulfilment(
  order: { id: string; orderNumber: string },
  lines: SalesLineDraft[],
  warehouseId: string,
): SalesFulfilmentPlan {
  const ref = { refType: "SALES_ORDER", refId: order.id };

  return {
    movements: lines.map((line) => ({
      itemId: line.itemId,
      warehouseId,
      qtyDelta: -line.quantity,
      reason: "SALES_ISSUE" as const,
      ...ref,
      note: `Issued for sales order ${order.orderNumber}`,
    })),
    costSnapshots: lines.map((line) => ({ id: line.id, unitCost: Number(line.costPrice) })),
  };
}
import type { Prisma, StockMovementReason } from "@prisma/client";
import { ApiError } from "@/lib/api-error";
import { assertStockDelta } from "@/lib/inventory/stock-rules";

/**
 * The one and only way stock changes.
 *
 * A Prisma transaction client, never the global client: the ledger row and the
 * `stock_levels` projection have to commit or roll back together, so the caller
 * owns the `$transaction` and passes its client in.
 */
export type StockTx = Prisma.TransactionClient;

export type StockMovementInput = {
  itemId: string;
  warehouseId: string;
  /** Signed and non-zero. Positive adds stock, negative removes it. */
  qtyDelta: number;
  reason: StockMovementReason;
  /** Originating aggregate, e.g. "WORK_ORDER" or "SALES_ORDER". */
  refType: string;
  refId: string;
  note?: string;
  /** Defaults to now. Only set when backdating a movement deliberately. */
  occurredAt?: Date;
};

/**
 * Thrown when a movement would take on-hand below zero. A 409: the request was
 * well-formed, it just conflicts with what is physically in the warehouse.
 */
export class InsufficientStockError extends ApiError {
  constructor(
    readonly itemId: string,
    readonly warehouseId: string,
    readonly available: number,
    readonly requested: number,
  ) {
    super(
      409,
      `Insufficient stock: ${requested} required but only ${available} on hand` +
        ` (item ${itemId}, warehouse ${warehouseId})`,
      { itemId, warehouseId, available, requested },
    );
    this.name = "InsufficientStockError";
  }
}

export class NoActiveWarehouseError extends ApiError {
  constructor() {
    super(409, "No active warehouse is available to hold stock");
    this.name = "NoActiveWarehouseError";
  }
}

/**
 * Applies one signed movement: writes the ledger row and moves the projection
 * in the same transaction.
 *
 * `stock_levels` stops being the source of truth - it is now the running total of
 * `stock_movements.qtyDelta` for the (item, warehouse) pair, and this function is
 * the only thing allowed to maintain it.
 */
export async function applyMovement(tx: StockTx, input: StockMovementInput) {
  assertStockDelta(input.qtyDelta);
  const magnitude = Math.abs(input.qtyDelta);

  if (input.qtyDelta < 0) {
    // A single conditional UPDATE rather than read-then-write. Under READ
    // COMMITTED, a concurrent writer that took the stock first forces Postgres to
    // re-evaluate this WHERE clause against the committed row before it proceeds,
    // so two callers cannot both pass on the same stale reading.
    const claimed = await tx.stockLevel.updateMany({
      where: {
        itemId: input.itemId,
        warehouseId: input.warehouseId,
        quantity: { gte: magnitude },
      },
      data: { quantity: { decrement: magnitude } },
    });

    if (claimed.count === 0) {
      // Either the row is short or it does not exist yet; both mean the same
      // thing to the caller, and neither has been written.
      const level = await tx.stockLevel.findUnique({
        where: {
          itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId },
        },
        select: { quantity: true },
      });
      throw new InsufficientStockError(
        input.itemId,
        input.warehouseId,
        level?.quantity ?? 0,
        magnitude,
      );
    }
  } else {
    await tx.stockLevel.upsert({
      where: {
        itemId_warehouseId: { itemId: input.itemId, warehouseId: input.warehouseId },
      },
      create: { itemId: input.itemId, warehouseId: input.warehouseId, quantity: magnitude },
      update: { quantity: { increment: magnitude } },
    });
  }

  const movement = await tx.stockMovement.create({
    data: {
      itemId: input.itemId,
      warehouseId: input.warehouseId,
      qtyDelta: input.qtyDelta,
      reason: input.reason,
      refType: input.refType,
      refId: input.refId,
      note: input.note,
      occurredAt: input.occurredAt,
    },
    select: { id: true },
  });

  return { movementId: movement.id, qtyDelta: input.qtyDelta };
}

/**
 * Applies movements in order. Sequential on purpose: order carries meaning
 * (consume before you produce, produce before you write off scrap) and each
 * conditional UPDATE holds a row lock for its duration anyway.
 */
export async function applyMovements(tx: StockTx, inputs: StockMovementInput[]) {
  const applied = [];
  for (const input of inputs) {
    applied.push(await applyMovement(tx, input));
  }
  return applied;
}

/**
 * The warehouse used when a document names none. Sales orders and purchase
 * orders both carry no warehouse, so they need one agreed answer rather than
 * each picking a row at random - otherwise the same item's stock ends up split
 * across bins depending on which route ran.
 */
export async function defaultWarehouseId(tx: StockTx): Promise<string> {
  const warehouse = await tx.warehouse.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!warehouse) throw new NoActiveWarehouseError();
  return warehouse.id;
}
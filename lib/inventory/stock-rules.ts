import type { Prisma } from "@prisma/client";

/**
 * The stock arithmetic and the policies around it, with no database and no
 * framework. Everything here is pure so it can be unit-tested directly; the
 * persistence half lives in `stock-service.ts`.
 */

/** A Prisma Decimal column, or a plain number/string when the value is not from the database. */
export type DecimalLike = Prisma.Decimal | number | string;

/**
 * Negative-stock policy, decided once for the whole application.
 *
 * "block": a movement that would take on-hand below zero is rejected and its
 * transaction rolls back. On-hand in an MES is a physical count, so a negative
 * balance is always a data-entry or BOM error, never a legitimate state - and
 * silently allowing it makes "on hand" meaningless as a floor for planning.
 *
 * Uniform because every mutation goes through `applyMovement`. Nothing else is
 * allowed to write `stock_levels`.
 */
export const NEGATIVE_STOCK_POLICY = "block" as const;

/**
 * BomComponent.quantity is Decimal(14,3) while StockLevel.quantity is a whole
 * number, so scaling a recipe requirement by an order size can land on a
 * fraction. Both helpers work in integer thousandths so the scaling is exact
 * rather than subject to binary floating point drift.
 */
export const BOM_QTY_SCALE = 1000;

/** Converts a Decimal(14,3) BOM quantity into integer thousandths. */
export function toScaledQty(quantity: DecimalLike): number {
  const value = Number(quantity);
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`BOM quantity must be a non-negative number, got ${quantity}`);
  }
  return Math.round(value * BOM_QTY_SCALE);
}

/**
 * Rounds a scaled requirement up to whole units.
 *
 * Consumption rounds up on purpose: booking less material than the recipe
 * demands would overstate what is still available and let the plant promise
 * output it cannot make. Rounding up can only ever make us look short, which is
 * the safe direction for a physical count.
 */
export function consumptionQtyFromScaled(scaled: number): number {
  return Math.ceil(scaled / BOM_QTY_SCALE);
}

/** Stock deltas are whole units and non-zero; a zero movement is a bug, not a no-op. */
export function assertStockDelta(qtyDelta: number, label = "qtyDelta") {
  if (!Number.isInteger(qtyDelta)) {
    throw new TypeError(`${label} must be a whole number of units, got ${qtyDelta}`);
  }
  if (qtyDelta === 0) {
    throw new RangeError(`${label} must not be zero; record no movement instead`);
  }
}

/**
 * Scrap is rejected at 100%: an order that produced nothing sellable is better
 * expressed as cancelled, and allowing it would let a COMPLETED order credit no
 * finished stock at all.
 */
export function normalizeScrapQty(scrapQty: number | undefined, quantity: number): number {
  if (scrapQty === undefined) return 0;
  if (!Number.isInteger(scrapQty) || scrapQty < 0) {
    throw new RangeError(`scrapQty must be a non-negative whole number, got ${scrapQty}`);
  }
  if (scrapQty >= quantity) {
    throw new RangeError(
      `scrapQty (${scrapQty}) must be less than the order quantity (${quantity})`,
    );
  }
  return scrapQty;
}

/**
 * The single negative-stock check. Kept as a named predicate so the policy is
 * stated once and can be asserted directly in tests.
 */
export function wouldGoNegative(available: number, qtyDelta: number): boolean {
  return available + qtyDelta < 0;
}
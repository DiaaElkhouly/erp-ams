/**
 * A work order's `itemId` is the BOM's finished good, never a BOM component.
 * Components are raw materials, so taking the first one credits cement to the
 * finished-goods bin when the order completes.
 *
 * The BOM's finished good is now a foreign key (`Bom.finishedItemId`), so this is
 * a check rather than a lookup: the finished item always exists, and all that is
 * left to reject is a client holding a different idea of what it is building.
 *
 * Kept free of Prisma so the rule is unit-testable; the route supplies the
 * already-fetched BOM.
 */

export type WorkOrderItemResolution =
  | { status: "resolved"; itemId: string }
  /** No finished item was supplied for the BOM. Unreachable through the FK; guarded anyway. */
  | { status: "unknown-finished-item"; finishedItemId: string }
  /** The caller sent an itemId that is not this BOM's finished good. */
  | { status: "item-id-mismatch"; finishedItemId: string };

export function resolveWorkOrderItem(
  finishedItemId: string | null | undefined,
  requestedItemId?: string,
): WorkOrderItemResolution {
  if (!finishedItemId) return { status: "unknown-finished-item", finishedItemId: "" };
  if (requestedItemId && requestedItemId !== finishedItemId) {
    return { status: "item-id-mismatch", finishedItemId };
  }
  return { status: "resolved", itemId: finishedItemId };
}
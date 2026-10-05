/**
 * Turns MRP suggestions into per-supplier purchase order drafts.
 *
 * Pure, like the other planners in this folder, because the decisions worth
 * getting right - which lines are still actionable, how they bucket, and what to
 * do about an item with no supplier - are all set logic rather than queries.
 *
 * The route does the reading and the writing; this decides the shape.
 */

export type MrpLineDraft = {
  id: string;
  itemId: string;
  suggestedQty: number;
  /** Denormalised from Item.preferredSupplierId when the run was computed. */
  supplierId: string | null;
  /** Set once the line has been turned into a purchase order. */
  purchaseOrderId?: string | null;
};

export type PurchaseOrderLineDraft = {
  itemId: string;
  quantity: number;
  unitCost: number;
};

export type PurchaseOrderDraft = {
  supplierId: string;
  lines: PurchaseOrderLineDraft[];
  /** The MRP lines this draft came from, so the caller can link them back. */
  lineIds: string[];
};

export type SkippedMrpLine = {
  lineId: string;
  itemId: string;
  reason: "already-ordered" | "no-supplier" | "nothing-to-order";
};

export type MrpToPoPlan = {
  drafts: PurchaseOrderDraft[];
  skipped: SkippedMrpLine[];
};

export type MrpToPoOptions = {
  /**
   * Supplier for items with no preferred one. Without it those lines are skipped
   * and reported rather than being assigned somewhere arbitrary - sending a
   * cement order to the steel supplier's account is worse than sending nothing.
   */
  fallbackSupplierId?: string | null;
  /** Cost used for the PO line. MRP suggests quantities; it has no prices. */
  unitCostByItem?: Record<string, number>;
};

/**
 * Groups an MRP run's suggestions into one draft purchase order per supplier.
 *
 * Ordered deterministically - suppliers by id, lines by item id - so pressing the
 * button twice against unchanged data produces the same documents in the same
 * order and a diff between two runs is readable.
 */
export function planPurchaseOrdersFromMrp(
  lines: MrpLineDraft[],
  options: MrpToPoOptions = {},
): MrpToPoPlan {
  const bySupplier = new Map<string, PurchaseOrderDraft>();
  const skipped: SkippedMrpLine[] = [];

  const actionable = [...lines].sort((a, b) => a.id.localeCompare(b.id));

  for (const line of actionable) {
    // Already bought. Without this a second click on the generate button doubles
    // the order, because the run's suggestions never change.
    if (line.purchaseOrderId) {
      skipped.push({ lineId: line.id, itemId: line.itemId, reason: "already-ordered" });
      continue;
    }
    if (!Number.isInteger(line.suggestedQty) || line.suggestedQty <= 0) {
      skipped.push({ lineId: line.id, itemId: line.itemId, reason: "nothing-to-order" });
      continue;
    }

    const supplierId = line.supplierId ?? options.fallbackSupplierId ?? null;
    if (!supplierId) {
      skipped.push({ lineId: line.id, itemId: line.itemId, reason: "no-supplier" });
      continue;
    }

    const existing = bySupplier.get(supplierId);
    const draft: PurchaseOrderLineDraft = {
      itemId: line.itemId,
      quantity: line.suggestedQty,
      unitCost: options.unitCostByItem?.[line.itemId] ?? 0,
    };
    if (existing) {
      existing.lines.push(draft);
      existing.lineIds.push(line.id);
    } else {
      bySupplier.set(supplierId, { supplierId, lines: [draft], lineIds: [line.id] });
    }
  }

  const drafts: PurchaseOrderDraft[] = [...bySupplier.values()]
    .map((draft) => ({
      ...draft,
      lines: [...draft.lines].sort((a, b) => a.itemId.localeCompare(b.itemId)),
    }))
    .sort((a, b) => a.supplierId.localeCompare(b.supplierId));

  return { drafts, skipped };
}
/**
 * When a stock movement should raise an alert.
 *
 * The reorder rule is the one the rest of the app already uses - on-hand at or
 * below `reorderPoint`, inclusive - but it was being re-implemented at four call
 * sites (inventory table, dashboard metrics, MRP, report data). This module is
 * the single definition, and the comparison that decides whether a movement
 * *newly* crossed it is here too, with no database so it can be tested directly.
 */

export type ReorderSubject = {
  itemId: string;
  sku: string;
  name: string;
  /** Total on hand across every warehouse, matching how MRP and the dashboard count. */
  onHandQty: number;
  reorderPoint: number;
  reorderQty: number;
};

export type ReorderAlert = {
  type: "REORDER_BREACH" | "REORDER_RECOVERED";
  severity: "WARNING" | "CRITICAL" | "INFO";
  itemId: string;
  sku: string;
  name: string;
  onHandQty: number;
  reorderPoint: number;
  /** How many units are missing to get back above the threshold. Zero on recovery. */
  shortfall: number;
  /** What MRP would suggest buying, for the breach case. Zero on recovery. */
  suggestedQty: number;
};

/** At or below the reorder point counts. Below it the item is already short. */
export function isBelowReorderPoint(onHandQty: number, reorderPoint: number): boolean {
  return onHandQty <= reorderPoint;
}

export function shortfall(onHandQty: number, reorderPoint: number): number {
  return Math.max(0, reorderPoint - onHandQty);
}

/**
 * Stock is reported in two tiers by `lib/report-data.ts`: at or below half the
 * reorder point is critical, otherwise merely low. The bell reuses that split
 * rather than inventing a third one.
 */
export function reorderSeverity(onHandQty: number, reorderPoint: number): "WARNING" | "CRITICAL" {
  return isBelowReorderPoint(onHandQty, Math.floor(reorderPoint / 2)) ? "CRITICAL" : "WARNING";
}

/**
 * Compares on-hand before and after a stock movement and reports only the items
 * that *crossed* the threshold, in either direction.
 *
 * Deliberately transition-based rather than state-based. Re-reporting every item
 * that sits below its reorder point on every single movement turns the bell into
 * a machine gun: a busy day fires hundreds of identical alerts. An item that was
 * already short stays quiet until something puts it back above the line.
 */
export function planReorderAlerts(before: ReorderSubject[], after: ReorderSubject[]): ReorderAlert[] {
  const beforeByItem = new Map(before.map((item) => [item.itemId, item]));

  const alerts: ReorderAlert[] = [];

  for (const current of after) {
    const previous = beforeByItem.get(current.itemId);
    // An item with no "before" reading was not touched by this movement. It may
    // well be short, but nothing about it changed, so it is not this alert's news.
    if (!previous) continue;

    const wasBelow = isBelowReorderPoint(previous.onHandQty, current.reorderPoint);
    const isBelow = isBelowReorderPoint(current.onHandQty, current.reorderPoint);

    if (!wasBelow && isBelow) {
      alerts.push({
        type: "REORDER_BREACH",
        severity: reorderSeverity(current.onHandQty, current.reorderPoint),
        itemId: current.itemId,
        sku: current.sku,
        name: current.name,
        onHandQty: current.onHandQty,
        reorderPoint: current.reorderPoint,
        shortfall: shortfall(current.onHandQty, current.reorderPoint),
        suggestedQty: Math.max(current.reorderQty, shortfall(current.onHandQty, current.reorderPoint)),
      });
    } else if (wasBelow && !isBelow) {
      // Without the recovery half, a breach alert stays in the feed forever and
      // the reason for it silently stops being true.
      alerts.push({
        type: "REORDER_RECOVERED",
        severity: "INFO",
        itemId: current.itemId,
        sku: current.sku,
        name: current.name,
        onHandQty: current.onHandQty,
        reorderPoint: current.reorderPoint,
        shortfall: 0,
        suggestedQty: 0,
      });
    }
  }

  return alerts.sort((a, b) => a.itemId.localeCompare(b.itemId));
}
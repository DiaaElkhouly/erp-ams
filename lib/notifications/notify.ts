import type { Prisma, NotificationSeverity } from "@prisma/client";
import {
  planReorderAlerts,
  type ReorderAlert,
  type ReorderSubject,
} from "@/lib/notifications/reorder";

/**
 * A transaction client, never the global client. Alerts are raised in the same
 * transaction as the movement that caused them: a work order that rolled back
 * must not leave the bell claiming its components ran out.
 */
export type NotificationTx = Prisma.TransactionClient;

export type AlertContext = {
  /** Originating document, e.g. "WORK_ORDER". Part of the dedupe key. */
  refType: string;
  refId: string;
};

const ALERT_COPY: Record<
  ReorderAlert["type"],
  { title: string; body: (alert: ReorderAlert) => string; href: string }
> = {
  REORDER_BREACH: {
    title: "Stock fell to its reorder point",
    body: (alert) =>
      `${alert.sku} - ${alert.name}: ${alert.onHandQty} on hand against a reorder point of ${alert.reorderPoint}. ` +
      `Short ${alert.shortfall} ${alert.shortfall === 1 ? "unit" : "units"}; suggested order ${alert.suggestedQty}.`,
    href: "/mrp",
  },
  REORDER_RECOVERED: {
    title: "Stock recovered above its reorder point",
    body: (alert) =>
      `${alert.sku} - ${alert.name} is back to ${alert.onHandQty} on hand, above the reorder point of ${alert.reorderPoint}.`,
    href: "/inventory",
  },
};

/**
 * Reads current on-hand for the given items, summed across every warehouse.
 *
 * Summed rather than read from one bin because that is how the reorder rule is
 * defined everywhere else: an item split over two warehouses is not short if the
 * two together hold enough.
 */
export async function loadReorderSubjects(
  tx: NotificationTx,
  itemIds: string[],
): Promise<ReorderSubject[]> {
  const unique = [...new Set(itemIds)];
  if (unique.length === 0) return [];

  const items = await tx.item.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      sku: true,
      name: true,
      reorderPoint: true,
      reorderQty: true,
      stockLevels: { select: { quantity: true } },
    },
  });

  return items.map((item) => ({
    itemId: item.id,
    sku: item.sku,
    name: item.name,
    onHandQty: item.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
    reorderPoint: item.reorderPoint,
    reorderQty: item.reorderQty,
  }));
}

/**
 * Raises one notification per threshold crossing.
 *
 * The dedupe key is scoped to the triggering document rather than to the item, so
 * the same item breaching twice on two different work orders alerts twice - that
 * is genuinely new information - while a replayed request against the same
 * document cannot double-ping. The unique index on `dedupeKey` is what enforces
 * that last part under concurrency; the lookup below only spares us the failed
 * insert in the common case.
 */
export async function raiseReorderAlerts(
  tx: NotificationTx,
  alerts: ReorderAlert[],
  context: AlertContext,
): Promise<number> {
  let raised = 0;

  for (const alert of alerts) {
    const dedupeKey = `${alert.type}:${context.refType}:${context.refId}:${alert.itemId}`;
    const copy = ALERT_COPY[alert.type];

    const existing = await tx.notification.findUnique({ where: { dedupeKey }, select: { id: true } });
    if (existing) continue;

    await tx.notification.create({
      data: {
        type: alert.type,
        severity: alert.severity as NotificationSeverity,
        title: copy.title,
        body: copy.body(alert),
        href: copy.href,
        dedupeKey,
      },
    });
    raised += 1;
  }

  return raised;
}

/**
 * The whole operation as one call: snapshot, then let the caller move stock,
 * then compare and raise. Split out so the three stock-moving routes all alert
 * identically instead of each hand-rolling the sequence.
 *
 * `mutate` receives the "before" subjects so it can decide which items it is
 * about to touch; everything after it is automatic.
 */
export async function withReorderAlerts<T>(
  tx: NotificationTx,
  itemIds: string[],
  context: AlertContext,
  mutate: (before: ReorderSubject[]) => Promise<T>,
): Promise<T> {
  const before = await loadReorderSubjects(tx, itemIds);
  const result = await mutate(before);
  const after = await loadReorderSubjects(tx, itemIds);
  await raiseReorderAlerts(tx, planReorderAlerts(before, after), context);
  return result;
}
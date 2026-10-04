/**
 * One-off repair for the T0.1 work-order `itemId` corruption.
 *
 * The production dialog used to send `Bom.components[0].item.id` as the work
 * order's `itemId`, so most work orders point at a raw material instead of the
 * BOM's finished good. Any work order already marked COMPLETED has therefore
 * inflated that raw material's stock.
 *
 * Since `Bom.finishedItemId` is a foreign key (Phase 1 / T1.3) the correct item is
 * no longer looked up by sku, so every affected row is repairable and there is no
 * unfixable case left to report.
 *
 * Run with `--dry` first.
 *
 *   npm run db:fix-work-order-items -- --dry
 *   npm run db:fix-work-order-items
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DRY = process.argv.includes("--dry");

async function main() {
  const workOrders = await db.workOrder.findMany({
    include: {
      bom: { select: { name: true, finishedItemId: true, finishedItem: { select: { sku: true } } } },
      item: { select: { sku: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const fixable = workOrders
    .filter((wo) => wo.itemId !== wo.bom.finishedItemId)
    .map((wo) => ({
      id: wo.id,
      orderNumber: wo.orderNumber,
      finishedItemId: wo.bom.finishedItemId,
      from: wo.item.sku,
      to: wo.bom.finishedItem.sku,
      completed: wo.status === "COMPLETED" ? wo.quantity : 0,
    }));

  console.log(`Scanned ${workOrders.length} work orders.`);

  if (fixable.length === 0) {
    console.log("Nothing to repair.");
  } else {
    console.log(`\nRepairing ${fixable.length} work order(s):`);
    for (const row of fixable) {
      console.log(
        `  ${row.orderNumber}  ${row.from} -> ${row.to}` +
          (row.completed ? `   (already COMPLETED, ${row.completed} units of stock to reverse manually)` : ""),
      );
    }
    if (DRY) {
      console.log("\nDry run: nothing written.");
    } else {
      await db.$transaction(
        fixable.map((row) => db.workOrder.update({ where: { id: row.id }, data: { itemId: row.finishedItemId } })),
      );
      console.log(`\nUpdated ${fixable.length} work order(s).`);
    }
  }

  const stockDamage = fixable.reduce((sum, row) => sum + row.completed, 0);
  if (stockDamage > 0) {
    console.log(
      `\nNOTE: ${stockDamage} unit(s) were credited to the wrong item by completed work orders.\n` +
        "Repointing itemId does not reverse that. Post an ADJUSTMENT movement against the\n" +
        "affected item rather than editing stock_levels directly, so the ledger still reconciles.",
    );
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
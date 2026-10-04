-- Phase 1 / T1.1 - StockMovement ledger.
--
-- StockLevel.quantity stops being the source of truth and becomes a projection
-- of SUM(stock_movements.qtyDelta) per (itemId, warehouseId). For that identity
-- to hold from the moment the ledger exists, every existing stock_levels row is
-- baselined below rather than being left as an unexplained balance.

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'PRODUCTION_OUTPUT', 'PRODUCTION_CONSUMPTION', 'SCRAP_WRITEOFF', 'SALES_ISSUE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "refType" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_movements_itemId_occurredAt_idx" ON "stock_movements"("itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_movements_refType_refId_idx" ON "stock_movements"("refType", "refId");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Baseline. md5() over the primary key keeps the id deterministic, so a retried
-- baseline cannot produce a second row for the same stock level. Rows sitting at
-- zero are included on purpose: the ledger should account for the whole table.
INSERT INTO "stock_movements" ("id", "itemId", "warehouseId", "qtyDelta", "reason", "refType", "refId", "note", "occurredAt", "createdAt")
SELECT
    md5(sl."id" || ':opening-balance'),
    sl."itemId",
    sl."warehouseId",
    sl."quantity",
    'OPENING_BALANCE',
    'MIGRATION',
    '20261004000100_stock_movement_ledger',
    'Baseline recorded when the StockMovement ledger was introduced.',
    sl."updatedAt",
    sl."updatedAt"
FROM "stock_levels" AS sl;
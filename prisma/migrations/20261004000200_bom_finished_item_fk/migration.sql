-- Phase 1 / T1.3 - Bom.finishedSku (free text) becomes a foreign key.
--
-- finishedSku was never validated against items, so a BOM could name a SKU that
-- does not exist and every work order raised from it resolved to nothing. The
-- column is added nullable, backfilled by exact sku match, and only then made
-- NOT NULL. Any BOM whose sku matches nothing aborts the whole migration rather
-- than being silently dropped along with the old column.

-- AlterTable
ALTER TABLE "boms" ADD COLUMN "finishedItemId" TEXT;

-- Backfill by sku match.
UPDATE "boms" AS b
SET "finishedItemId" = i."id"
FROM "items" AS i
WHERE i."sku" = b."finishedSku";

-- Fail loudly on orphans.
DO $$
DECLARE
    orphans TEXT;
BEGIN
    SELECT string_agg(b."name" || ' [finishedSku=' || b."finishedSku" || ']', '; ' ORDER BY b."name")
    INTO orphans
    FROM "boms" AS b
    WHERE b."finishedItemId" IS NULL;

    IF orphans IS NOT NULL THEN
        RAISE EXCEPTION 'boms.finishedItemId backfill failed - these BOMs name a finishedSku that matches no item: %', orphans;
    END IF;
END $$;

-- AlterTable
ALTER TABLE "boms" ALTER COLUMN "finishedItemId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "boms_finishedItemId_idx" ON "boms"("finishedItemId");

-- AddForeignKey
ALTER TABLE "boms" ADD CONSTRAINT "boms_finishedItemId_fkey" FOREIGN KEY ("finishedItemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The SKU is now reachable through the relation, so the duplicate copy of it goes.
ALTER TABLE "boms" DROP COLUMN "finishedSku";
-- Phase 1 / T1.7 - updatedAt on the four models that lacked it.
--
-- Warehouse, Customer, Supplier and Bom had no way to tell a stale client from a
-- current one, which is what the optimistic-concurrency checks in T2.1 need.
--
-- The column is added nullable, backfilled from createdAt, then made NOT NULL.
-- Prisma's @updatedAt is maintained by the client, so no database default is
-- declared - one here would be invisible in the schema and would hide a write
-- that skipped the ORM.
ALTER TABLE "boms" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "boms" SET "updatedAt" = "createdAt";

ALTER TABLE "boms" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "customers" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "customers" SET "updatedAt" = "createdAt";

ALTER TABLE "customers" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "suppliers" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "suppliers" SET "updatedAt" = "createdAt";

ALTER TABLE "suppliers" ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "warehouses" ADD COLUMN "updatedAt" TIMESTAMP(3);

UPDATE "warehouses" SET "updatedAt" = "createdAt";

ALTER TABLE "warehouses" ALTER COLUMN "updatedAt" SET NOT NULL;
-- Phase 4 / T4.3 - Object storage keys for user-attached files.
--
-- Three nullable object keys, not a generic Attachment table: each of these has
-- exactly one owning aggregate and one plausible file, so a join table would be
-- a second place to get the ownership wrong. Lab results can accumulate several
-- documents, which is the one case a join table would win -- until then the key
-- stays on the row it describes.
--
-- These are keys, not URLs. Presigned on read (app/api/uploads), so the bucket
-- stays private and every key branches with the row that points at it.

-- AlterTable
ALTER TABLE "items" ADD COLUMN "photoKey" TEXT;

-- AlterTable
ALTER TABLE "lab_test_records" ADD COLUMN "attachmentKey" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "documentKey" TEXT;
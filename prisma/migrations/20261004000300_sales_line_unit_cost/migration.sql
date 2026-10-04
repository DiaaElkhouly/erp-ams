-- Phase 1 / T1.6 - freeze COGS on the sales line at fulfilment.
--
-- Deliberately left NULL on every existing row. Reporting reads
-- unitCost ?? item.costPrice, so historical margins keep resolving exactly as
-- they do today; only lines fulfilled from now on carry a snapshot.
ALTER TABLE "sales_order_lines" ADD COLUMN "unitCost" DECIMAL(14, 2);
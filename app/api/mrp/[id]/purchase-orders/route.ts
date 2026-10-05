import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";
import { planPurchaseOrdersFromMrp } from "@/lib/inventory/mrp-to-po";

const schema = z.object({
  /**
   * Used for lines whose item has no preferred supplier. Optional on purpose -
   * omitting it makes those lines come back in `skipped` instead of guessing.
   */
  fallbackSupplierId: z.string().min(1).optional(),
});

/**
 * Turns an MRP run into draft purchase orders, one per supplier.
 *
 * Needs both modules and checks both: an MRP manager can see the suggestion but
 * may not have purchasing rights, and a purchasing officer with no production
 * remit has no business reading the demand calculation.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mrpAccess = await requireModuleAccess("mrp");
  if (mrpAccess.error) return mrpAccess.error;
  const purchasingAccess = await requireModuleAccess("purchasing");
  if (purchasingAccess.error) return purchasingAccess.error;

  try {
    const { id } = await params;
    const body = schema.parse(await req.json().catch(() => ({})));
    const userId = mrpAccess.session!.user.id;

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "PURCHASE_ORDER", (data: any) => data?.id, async () => {
      const result = await db.$transaction(async (tx) => {
        const run = await tx.mrpRun.findUnique({
          where: { id },
          include: { lines: { include: { item: { select: { costPrice: true } } } } },
        });
        if (!run) throw notFound("MRP run not found");

        const costByItem = Object.fromEntries(
          run.lines.map((line) => [line.itemId, Number(line.item.costPrice)]),
        );

        const { drafts, skipped } = planPurchaseOrdersFromMrp(run.lines, {
          fallbackSupplierId: body.fallbackSupplierId,
          unitCostByItem: costByItem,
        });

        if (drafts.length === 0) {
          throw conflict(
            `Nothing to order from ${run.name}: every suggestion is already on a purchase order or has no supplier.`,
            { skipped },
          );
        }

        // Per supplier: one PO, and every line it came from linked back to it. That
        // link is what makes the button idempotent in practice - regenerating skips
        // the lines that already have one, instead of buying everything twice.
        const purchaseOrders = [];
        for (const draft of drafts) {
          const order = await tx.purchaseOrder.create({
            data: {
              orderNumber: generateOrderNumber("PO"),
              supplierId: draft.supplierId,
              createdById: userId,
              mrpRunId: run.id,
              lines: { create: draft.lines },
            },
            include: { supplier: true, lines: { include: { item: true } } },
          });
          await tx.mrpLine.updateMany({
            where: { id: { in: draft.lineIds } },
            data: { purchaseOrderId: order.id },
          });
          purchaseOrders.push(order);
        }

        return { runId: run.id, purchaseOrders, skipped };
      });

      return { data: result, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
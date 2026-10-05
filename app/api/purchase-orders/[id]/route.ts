import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { applyMovements, defaultWarehouseId, type StockMovementInput } from "@/lib/inventory/stock-service";
import { withReorderAlerts } from "@/lib/notifications/notify";

const updateSchema = z
  .object({
    status: z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]).optional(),
    /** Object key of the supplier's PDF quote or delivery note. Nullable to clear it. */
    documentKey: z.string().min(1).nullable().optional(),
  })
  .refine((body) => body.status !== undefined || body.documentKey !== undefined, {
    message: "Provide a status or a documentKey",
  });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const body = updateSchema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "PURCHASE_ORDER", (data: any) => data?.id ?? id, async () => {
      const order = await db.$transaction(async (tx) => {
        const current = await tx.purchaseOrder.findUnique({
          where: { id },
          include: { lines: true },
        });
        if (!current) throw notFound("Purchase order not found");

        // Attaching a document is a metadata edit: it must not run the status
        // flow, or uploading a PDF to a RECEIVED order would throw below.
        if (body.status === undefined) {
          return tx.purchaseOrder.update({
            where: { id },
            data: { documentKey: body.documentKey ?? null },
            include: { lines: true },
          });
        }

        // Receiving twice would book the same delivery into stock twice.
        if (current.status === "RECEIVED") {
          throw conflict(`Purchase order ${current.orderNumber} is already received and cannot change status`);
        }

        if (body.status !== "RECEIVED") {
          return tx.purchaseOrder.update({
            where: { id },
            data: { status: body.status, documentKey: body.documentKey ?? undefined },
            include: { lines: true },
          });
        }

        // A purchase order names no warehouse, so stock lands in the agreed default bin.
        const warehouseId = await defaultWarehouseId(tx);
        const ref = { refType: "PURCHASE_ORDER", refId: current.id };
        const receipts: StockMovementInput[] = current.lines.map((line) => ({
          itemId: line.itemId,
          warehouseId,
          qtyDelta: line.quantity,
          reason: "PURCHASE_RECEIPT",
          ...ref,
          note: `Received against purchase order ${current.orderNumber}`,
        }));

        // Receiving is the one movement that can clear a reorder breach, so the alerts
        // it raises are recoveries rather than warnings.
        await withReorderAlerts(
          tx,
          receipts.map((r) => r.itemId),
          { refType: "PURCHASE_ORDER", refId: current.id },
          () => applyMovements(tx, receipts),
        );

        return tx.purchaseOrder.update({
          where: { id },
          data: { status: "RECEIVED", documentKey: body.documentKey ?? undefined },
          include: { lines: true },
        });
      });

      return { data: order };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "PURCHASE_ORDER", () => id, async () => {
      await db.purchaseOrder.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

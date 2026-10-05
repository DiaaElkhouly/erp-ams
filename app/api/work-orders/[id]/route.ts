import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { applyMovements } from "@/lib/inventory/stock-service";
import { planWorkOrderCompletion } from "@/lib/inventory/work-order-completion";
import { withReorderAlerts } from "@/lib/notifications/notify";

const statusSchema = z.object({
  status: z.enum(["PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  /** Units produced but rejected. Omit for a clean run. */
  scrapQty: z.coerce.number().int().nonnegative().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "WORK_ORDER", (data: any) => data?.id ?? id, async () => {
      const workOrder = await db.$transaction(async (tx) => {
        const current = await tx.workOrder.findUnique({
          where: { id },
          include: { bom: { include: { components: true } } },
        });
        if (!current) throw notFound("Work order not found");

        // Completion and cancellation both move stock, and nothing here reverses it.
        // Refusing to leave COMPLETED keeps the ledger append-only, and refusing to
        // re-complete stops the same batch being consumed and credited twice.
        if (current.status === "COMPLETED") {
          throw conflict(`Work order ${current.orderNumber} is already completed and cannot change status`);
        }

        if (body.status !== "COMPLETED") {
          return tx.workOrder.update({ where: { id }, data: { status: body.status } });
        }

        // The BOM owns the finished good. A work order pointing anywhere else is a
        // corrupt row from before the foreign key existed; refuse to move stock on it.
        if (current.itemId !== current.bom.finishedItemId) {
          throw conflict(
            `Work order ${current.orderNumber} is not set up to produce the BOM's finished good. ` +
              `Repoint it before completing.`,
            { bomFinishedItemId: current.bom.finishedItemId, workOrderItemId: current.itemId },
          );
        }

        const movements = planWorkOrderCompletion(
          {
            orderId: current.id,
            orderNumber: current.orderNumber,
            warehouseId: current.warehouseId,
            quantity: current.quantity,
            finishedItemId: current.bom.finishedItemId,
            components: current.bom.components,
          },
          body.scrapQty,
        );

        // One transaction: if any component is short, applyMovement throws and the
        // order stays IN_PROGRESS with the ledger untouched.
        //
        // Wrapped in withReorderAlerts because completing a batch is the single
        // biggest consumer in the plant: it is exactly when a component drops
        // through its reorder point, and without this nothing tells anyone.
        await withReorderAlerts(
          tx,
          movements.map((m) => m.itemId),
          { refType: "WORK_ORDER", refId: current.id },
          () => applyMovements(tx, movements),
        );

        return tx.workOrder.update({
          where: { id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
      });

      return { data: workOrder };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "WORK_ORDER", () => id, async () => {
      await db.workOrder.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
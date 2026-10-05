import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { applyMovements, defaultWarehouseId } from "@/lib/inventory/stock-service";
import { planSalesFulfilment } from "@/lib/inventory/sales-fulfilment";

const statusSchema = z.object({ status: z.enum(["DRAFT", "CONFIRMED", "FULFILLED", "CANCELLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "SALES_ORDER", (data: any) => data?.id ?? id, async () => {
      const order = await db.$transaction(async (tx) => {
        const current = await tx.salesOrder.findUnique({
          where: { id },
          include: { lines: { include: { item: { select: { costPrice: true } } } } },
        });
        if (!current) throw notFound("Sales order not found");

        if (current.status === "FULFILLED") {
          throw conflict(`Sales order ${current.orderNumber} is already fulfilled and cannot change status`);
        }

        if (body.status !== "FULFILLED") {
          return tx.salesOrder.update({ where: { id }, data: { status: body.status } });
        }

        // A sales order names no warehouse, so stock leaves the agreed default bin.
        const warehouseId = await defaultWarehouseId(tx);

        const plan = planSalesFulfilment(
          { id: current.id, orderNumber: current.orderNumber },
          current.lines.map((line) => ({
            id: line.id,
            itemId: line.itemId,
            quantity: line.quantity,
            costPrice: line.item.costPrice,
          })),
          warehouseId,
        );

        // Short stock aborts the whole fulfilment rather than shipping part an order.
        await applyMovements(tx, plan.movements);

        // Freeze what each unit cost at the moment it left the warehouse, so editing
        // an item's cost later cannot rewrite this order's reported margin.
        await Promise.all(
          plan.costSnapshots.map((snapshot) =>
            tx.salesOrderLine.update({
              where: { id: snapshot.id },
              data: { unitCost: snapshot.unitCost },
            }),
          ),
        );

        return tx.salesOrder.update({
          where: { id },
          data: { status: "FULFILLED" },
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
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "SALES_ORDER", () => id, async () => {
      await db.salesOrder.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
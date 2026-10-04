import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { applyMovements, defaultWarehouseId, type StockMovementInput } from "@/lib/inventory/stock-service";

const statusSchema = z.object({ status: z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());

    const order = await db.$transaction(async (tx) => {
      const current = await tx.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!current) throw notFound("Purchase order not found");

      // Receiving twice would book the same delivery into stock twice.
      if (current.status === "RECEIVED") {
        throw conflict(`Purchase order ${current.orderNumber} is already received and cannot change status`);
      }

      if (body.status !== "RECEIVED") {
        return tx.purchaseOrder.update({
          where: { id },
          data: { status: body.status },
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

      await applyMovements(tx, receipts);

      return tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
        include: { lines: true },
      });
    });

    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    await db.purchaseOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

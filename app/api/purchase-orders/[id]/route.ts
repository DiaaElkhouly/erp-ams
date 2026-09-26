import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const statusSchema = z.object({ status: z.enum(["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());
    const order = await db.purchaseOrder.update({
      where: { id },
      data: { status: body.status },
      include: { lines: true },
    });

    // On receipt, increment stock for each line in the default warehouse (first active one).
    if (body.status === "RECEIVED") {
      const warehouse = await db.warehouse.findFirst({ where: { isActive: true } });
      if (warehouse) {
        for (const line of order.lines) {
          await db.stockLevel.upsert({
            where: { itemId_warehouseId: { itemId: line.itemId, warehouseId: warehouse.id } },
            create: { itemId: line.itemId, warehouseId: warehouse.id, quantity: line.quantity },
            update: { quantity: { increment: line.quantity } },
          });
        }
      }
    }

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

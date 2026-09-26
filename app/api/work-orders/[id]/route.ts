import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const statusSchema = z.object({
  status: z.enum(["PLANNED", "RELEASED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());
    const workOrder = await db.workOrder.update({
      where: { id },
      data: {
        status: body.status,
        completedAt: body.status === "COMPLETED" ? new Date() : undefined,
      },
    });

    // On completion, increment finished-goods stock in the target warehouse.
    if (body.status === "COMPLETED") {
      await db.stockLevel.upsert({
        where: { itemId_warehouseId: { itemId: workOrder.itemId, warehouseId: workOrder.warehouseId } },
        create: { itemId: workOrder.itemId, warehouseId: workOrder.warehouseId, quantity: workOrder.quantity },
        update: { quantity: { increment: workOrder.quantity } },
      });
    }

    return NextResponse.json(workOrder);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const { id } = await params;
    await db.workOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

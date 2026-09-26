import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";

const schema = z.object({
  bomId: z.string().min(1),
  itemId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  dueDate: z.string().optional(),
});

export async function GET() {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  const workOrders = await db.workOrder.findMany({
    include: { bom: true, item: true, warehouse: true, createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ workOrders });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const workOrder = await db.workOrder.create({
      data: {
        orderNumber: generateOrderNumber("WO"),
        bomId: body.bomId,
        itemId: body.itemId,
        warehouseId: body.warehouseId,
        quantity: body.quantity,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        createdById: session!.user.id,
      },
      include: { bom: true, item: true, warehouse: true },
    });
    return NextResponse.json(workOrder, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

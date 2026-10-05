import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";
import { notFound } from "@/lib/api-error";
import { resolveWorkOrderItem } from "@/lib/work-order-item";

const schema = z.object({
  bomId: z.string().min(1),
  // Optional and advisory only. The finished good is always resolved from the BOM.
  itemId: z.string().min(1).optional(),
  warehouseId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  dueDate: z.string().optional(),
});

export async function GET() {
  const { error } = await requireModuleAccess("production");
  if (error) return error;
  const workOrders = await db.workOrder.findMany({
    include: {
      bom: { include: { finishedItem: { select: { sku: true, name: true } } } },
      item: true,
      warehouse: true,
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ workOrders });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("production");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const bom = await db.bom.findUnique({
      where: { id: body.bomId },
      select: { id: true, name: true, finishedItemId: true, finishedItem: { select: { sku: true } } },
    });
    if (!bom) {
      throw notFound("BOM not found");
    }

    // The finished good is a property of the BOM, never of the request.
    const resolved = resolveWorkOrderItem(bom.finishedItemId, body.itemId);

    // Unreachable while `finishedItemId` is a non-null foreign key, but a missing
    // finished good has to fail loudly rather than create a work order with no item.
    if (resolved.status === "unknown-finished-item") {
      return NextResponse.json(
        { error: `BOM "${bom.name}" has no finished item, so there is nothing to produce` },
        { status: 422 },
      );
    }

    // Reject a stale client rather than silently correcting it: the caller is
    // holding a BOM revision that does not match this one.
    if (resolved.status === "item-id-mismatch") {
      return NextResponse.json(
        { error: `itemId does not match the BOM's finished good (${bom.finishedItem.sku})` },
        { status: 422 },
      );
    }

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "WORK_ORDER", (data: any) => data?.id, async () => {
      const workOrder = await db.workOrder.create({
        data: {
          orderNumber: generateOrderNumber("WO"),
          bomId: bom.id,
          itemId: resolved.itemId,
          warehouseId: body.warehouseId,
          quantity: body.quantity,
          dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
          createdById: session!.user.id,
        },
        include: { bom: { include: { finishedItem: true } }, item: true, warehouse: true },
      });
      return { data: workOrder, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

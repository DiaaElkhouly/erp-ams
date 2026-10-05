import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";

const schema = z.object({
  supplierId: z.string().min(1),
  lines: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    unitCost: z.coerce.number().nonnegative(),
  })).min(1),
});

export async function GET() {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  const purchaseOrders = await db.purchaseOrder.findMany({
    include: { supplier: true, lines: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ purchaseOrders });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "PURCHASE_ORDER", (data: any) => data?.id, async () => {
      const purchaseOrder = await db.purchaseOrder.create({
        data: {
          orderNumber: generateOrderNumber("PO"),
          supplierId: body.supplierId,
          createdById: session!.user.id,
          lines: { create: body.lines },
        },
        include: { supplier: true, lines: { include: { item: true } } },
      });
      return { data: purchaseOrder, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";

const schema = z.object({
  customerId: z.string().min(1),
  lines: z.array(z.object({
    itemId: z.string().min(1),
    quantity: z.coerce.number().int().positive(),
    unitPrice: z.coerce.number().nonnegative(),
  })).min(1),
});

export async function GET() {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  const salesOrders = await db.salesOrder.findMany({
    include: { customer: true, lines: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ salesOrders });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());
    const salesOrder = await db.salesOrder.create({
      data: {
        orderNumber: generateOrderNumber("SO"),
        customerId: body.customerId,
        createdById: session!.user.id,
        lines: { create: body.lines },
      },
      include: { customer: true, lines: { include: { item: true } } },
    });
    return NextResponse.json(salesOrder, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

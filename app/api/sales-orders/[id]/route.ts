import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const statusSchema = z.object({ status: z.enum(["DRAFT", "CONFIRMED", "FULFILLED", "CANCELLED"]) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    const body = statusSchema.parse(await req.json());
    const order = await db.salesOrder.update({ where: { id }, data: { status: body.status } });
    return NextResponse.json(order);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    await db.salesOrder.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

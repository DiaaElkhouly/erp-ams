import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  reorderPoint: z.coerce.number().int().nonnegative().optional(),
  reorderQty: z.coerce.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;
  try {
    const { id } = await params;
    const body = updateSchema.parse(await req.json());
    const item = await db.item.update({ where: { id }, data: body });
    return NextResponse.json(item);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;
  try {
    const { id } = await params;
    await db.item.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}

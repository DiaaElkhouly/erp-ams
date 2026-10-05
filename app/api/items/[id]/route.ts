import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const updateSchema = z.object({
  /** Unique, so a clash is a 409 rather than a validation error. */
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["RAW_MATERIAL", "COMPONENT", "FINISHED_GOOD", "CONSUMABLE"]).optional(),
  unit: z.string().min(1).optional(),
  costPrice: z.coerce.number().nonnegative().optional(),
  salePrice: z.coerce.number().nonnegative().optional(),
  reorderPoint: z.coerce.number().int().nonnegative().optional(),
  reorderQty: z.coerce.number().int().nonnegative().optional(),
  /** Nullable so an item can be taken off every supplier's catalogue. */
  preferredSupplierId: z.string().min(1).nullable().optional(),
  /** Storage object key, written by the presigned-upload flow (T4.3). */
  photoKey: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "ITEM", (data: any) => data?.id ?? id, async () => {
      const body = updateSchema.parse(await req.json());
      const item = await db.item.update({ where: { id }, data: body });
      return { data: item };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("inventory");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "ITEM", () => id, async () => {
      await db.item.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

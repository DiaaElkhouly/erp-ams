import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const componentSchema = z.object({ itemId: z.string().min(1), quantity: z.coerce.number().positive() });

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  finishedItemId: z.string().min(1).optional(),
  /**
   * Present means "replace the whole component list". Absent leaves the existing
   * rows alone, so a rename cannot silently drop a component.
   */
  components: z.array(componentSchema).min(1).optional(),
  isActive: z.boolean().optional(),
});

const include = { finishedItem: true, components: { include: { item: true } } } as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("bom");
  if (error) return error;
  try {
    const { id } = await params;
    const body = updateSchema.parse(await req.json());
    const { withIdempotency } = await import("@/lib/idempotency");

    return withIdempotency(req, "UPDATE", "BOM", (data: any) => data?.id ?? id, async () => {
      const bom = await db.$transaction(async (tx) => {
        const current = await tx.bom.findUnique({ where: { id }, include: { _count: { select: { workOrders: true } } } });
        if (!current) throw notFound("BOM not found");

        // Work-order completion consumes whatever BomComponent rows exist at
        // completion time. Rewriting the list of a BOM that has already been
        // produced would retroactively change what those work orders consumed, and
        // the stock ledger written then would no longer be reproducible. A new
        // version is the answer; editing this one is refused.
        const rewritesComposition = body.components !== undefined || body.finishedItemId !== undefined;
        if (rewritesComposition && current._count.workOrders > 0) {
          throw conflict(
            `This BOM has ${current._count.workOrders} work order(s). Create a new version instead of changing its components.`
          );
        }

        // deleteMany + create rather than a nested update: a component removed from
        // the list has to go, and Prisma's nested write cannot express a delete plus
        // a create of the same rows in one statement.
        if (body.components) {
          await tx.bomComponent.deleteMany({ where: { bomId: id } });
          await tx.bomComponent.createMany({
            data: body.components.map((component) => ({ ...component, bomId: id })),
          });
        }

        return tx.bom.update({
          where: { id },
          data: {
            name: body.name,
            version: body.version,
            finishedItemId: body.finishedItemId,
            isActive: body.isActive,
          },
          include,
        });
      });

      return { data: bom };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("bom");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "BOM", () => id, async () => {
      const bom = await db.bom.findUnique({ where: { id }, include: { _count: { select: { workOrders: true } } } });
      if (!bom) throw notFound("BOM not found");

      // BomComponent cascades with the BOM, but WorkOrder.bomId does not. Deactivating
      // keeps the recipe reachable from historical orders; deleting it would orphan them.
      if (bom._count.workOrders > 0) {
        throw conflict(
          `This BOM has ${bom._count.workOrders} work order(s) and cannot be deleted. Set it inactive instead.`
        );
      }

      await db.bom.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
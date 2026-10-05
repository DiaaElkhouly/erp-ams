import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  /** Nullable: clearing a contact detail is an edit, not an omission. */
  email: z.string().email().nullable().optional().or(z.literal("")),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "SUPPLIER", (data: any) => data?.id ?? id, async () => {
      const body = updateSchema.parse(await req.json());
      // Empty string means "cleared" from the form's point of view.
      const data = { ...body, email: body.email === "" ? null : body.email };
      const supplier = await db.supplier.update({ where: { id }, data });
      return { data: supplier };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("purchasing");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "SUPPLIER", () => id, async () => {
      const supplier = await db.supplier.findUnique({
        where: { id },
        include: {
          _count: { select: { purchaseOrders: true, supplierInvoices: true, mrpLines: true } },
        },
      });
      if (!supplier) throw notFound("Supplier not found");

      // Orders and invoices reference the supplier with no cascade. Deleting would
      // either fail with a raw constraint error or take the ledger with it.
      const { purchaseOrders, supplierInvoices, mrpLines } = supplier._count;
      if (purchaseOrders > 0 || supplierInvoices > 0 || mrpLines > 0) {
        throw conflict(
          `Supplier has ${purchaseOrders} purchase order(s), ${supplierInvoices} invoice(s) and ${mrpLines} MRP line(s) and cannot be deleted.`
        );
      }

      await db.supplier.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
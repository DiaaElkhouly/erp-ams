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
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "CUSTOMER", (data: any) => data?.id ?? id, async () => {
      const body = updateSchema.parse(await req.json());
      // Empty string means "cleared" from the form's point of view.
      const data = { ...body, email: body.email === "" ? null : body.email };
      const customer = await db.customer.update({ where: { id }, data });
      return { data: customer };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("sales");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "CUSTOMER", () => id, async () => {
      const customer = await db.customer.findUnique({
        where: { id },
        include: { _count: { select: { salesOrders: true, customerInvoices: true } } },
      });
      if (!customer) throw notFound("Customer not found");

      // Orders and invoices reference the customer with no cascade. Deleting would
      // either fail with a raw constraint error or take the ledger with it, so this
      // is refused in words the UI can show.
      const { salesOrders, customerInvoices } = customer._count;
      if (salesOrders > 0 || customerInvoices > 0) {
        throw conflict(
          `Customer has ${salesOrders} sales order(s) and ${customerInvoices} invoice(s) and cannot be deleted.`
        );
      }

      await db.customer.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
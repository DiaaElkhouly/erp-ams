import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { conflict, notFound } from "@/lib/api-error";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { resolvePaymentStatus } from "@/lib/finance/invoice";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: z.string().optional(),
});

const include = { customer: true, lines: { include: { item: true } }, payments: true } as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const { id } = await params;
    const invoice = await db.customerInvoice.findUnique({ where: { id }, include });
    if (!invoice) throw notFound("Customer invoice not found");
    // Overdue is derived on read rather than persisted: it becomes true at
    // midnight on a document nobody touched.
    return NextResponse.json({ ...invoice, status: resolvePaymentStatus(invoice) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "UPDATE", "CUSTOMER_INVOICE", (data: any) => data?.id ?? id, async () => {
      const current = await db.customerInvoice.findUnique({ where: { id }, include });
      if (!current) throw notFound("Customer invoice not found");

      if (current.status === "CANCELLED") {
        throw conflict(`Customer invoice ${current.invoiceNumber} is cancelled and cannot be changed`);
      }

      if (body.status === "DRAFT" && current.status !== "DRAFT") {
        throw conflict(`Customer invoice ${current.invoiceNumber} is already issued and cannot go back to draft`);
      }

      const invoice = await db.customerInvoice.update({
        where: { id },
        data: { status: body.status, dueDate: body.dueDate, notes: body.notes },
        include,
      });

      return {
        data: {
          ...invoice,
          status: resolvePaymentStatus(invoice),
        },
      };
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * Deletes an invoice that has no payments against it.
 *
 * Payment rows cascade on delete, so a settled invoice cannot simply be deleted
 * without taking its ledger with it. Those get CANCELLED instead, which keeps the
 * record of what was collected and still stops anyone chasing it again.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const { id } = await params;
    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(_req, "DELETE", "CUSTOMER_INVOICE", () => id, async () => {
      const current = await db.customerInvoice.findUnique({ where: { id }, include: { payments: { select: { id: true } } } });
      if (!current) throw notFound("Customer invoice not found");
      if (current.payments.length > 0) {
        throw conflict(
          `Customer invoice ${current.invoiceNumber} has ${current.payments.length} payment(s) recorded against it. Cancel it instead of deleting it.`,
        );
      }
      await db.customerInvoice.delete({ where: { id } });
      return { data: { success: true } };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireModuleAccess, handleApiError } from "@/lib/api-helpers";
import { generateOrderNumber } from "@/lib/utils";
import { invoiceTotals } from "@/lib/finance/invoice";

const lineSchema = z.object({
  itemId: z.string().min(1).optional(),
  description: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

const schema = z.object({
  supplierId: z.string().min(1),
  purchaseOrderId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  const supplierInvoices = await db.supplierInvoice.findMany({
    include: { supplier: true, lines: { include: { item: true } }, payments: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ supplierInvoices });
}

/**
 * A bill from a supplier. Created as DRAFT so the totals can be corrected before
 * anything is issued; only an issued invoice accrues a due date.
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const totals = invoiceTotals(
      body.lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitCost })),
      body.taxRatePercent,
    );

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "SUPPLIER_INVOICE", (data: any) => data?.id, async () => {
      const supplierInvoice = await db.supplierInvoice.create({
        data: {
          invoiceNumber: generateOrderNumber("SINV"),
          supplierId: body.supplierId,
          purchaseOrderId: body.purchaseOrderId,
          dueDate: body.dueDate,
          notes: body.notes,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          createdById: session!.user.id,
          lines: {
            create: body.lines.map((line) => ({
              itemId: line.itemId,
              description: line.description,
              quantity: line.quantity,
              unitCost: line.unitCost,
              lineTotal: Math.round(line.quantity * line.unitCost * 100) / 100,
            })),
          },
        },
        include: { supplier: true, lines: { include: { item: true } }, payments: true },
      });
      return { data: supplierInvoice, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}
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
  unitPrice: z.coerce.number().nonnegative(),
});

const schema = z.object({
  customerId: z.string().min(1),
  salesOrderId: z.string().min(1).optional(),
  dueDate: z.coerce.date().optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function GET() {
  const { error } = await requireModuleAccess("finance");
  if (error) return error;
  const customerInvoices = await db.customerInvoice.findMany({
    include: { customer: true, lines: { include: { item: true } }, payments: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ customerInvoices });
}

/** What we bill a customer. Same shape as a supplier invoice, opposite direction. */
export async function POST(req: NextRequest) {
  const { session, error } = await requireModuleAccess("finance");
  if (error) return error;
  try {
    const body = schema.parse(await req.json());

    const totals = invoiceTotals(
      body.lines.map((line) => ({ quantity: line.quantity, unitPrice: line.unitPrice })),
      body.taxRatePercent,
    );

    const { withIdempotency } = await import("@/lib/idempotency");
    return withIdempotency(req, "CREATE", "CUSTOMER_INVOICE", (data: any) => data?.id, async () => {
      const customerInvoice = await db.customerInvoice.create({
        data: {
          invoiceNumber: generateOrderNumber("CINV"),
          customerId: body.customerId,
          salesOrderId: body.salesOrderId,
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
              unitPrice: line.unitPrice,
              lineTotal: Math.round(line.quantity * line.unitPrice * 100) / 100,
            })),
          },
        },
        include: { customer: true, lines: { include: { item: true } }, payments: true },
      });
      return { data: customerInvoice, status: 201 };
    });
  } catch (err) {
    return handleApiError(err);
  }
}